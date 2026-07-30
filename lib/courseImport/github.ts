import 'server-only';
import type { RepoFile } from './types';

/**
 * Raised when there is genuinely nothing to import: either the repository has
 * no commits at all (GitHub answers 409 on the git-data endpoints), or the
 * configured path contains no files.
 *
 * Typed rather than a flat string so the UI can offer to commit the starter
 * template. Content that EXISTS but fails to parse must never surface as this
 * error -- that path keeps its parse error, so we never write over real work.
 */
export class CourseImportEmptyError extends Error {
    readonly kind: 'repo' | 'path';

    constructor(kind: 'repo' | 'path', message: string) {
        super(message);
        this.name = 'CourseImportEmptyError';
        this.kind = kind;
    }
}

interface GitTreeEntry {
    path: string;
    type: 'blob' | 'tree';
    sha: string;
}

interface GitTreeResponse {
    tree: GitTreeEntry[];
    truncated: boolean;
}

interface GitBlobResponse {
    content: string;
    encoding: string;
}

function githubHeaders(pat: string): Record<string, string> {
    return {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

async function githubFetch(path: string, pat: string): Promise<Response> {
    const response = await fetch(`https://api.github.com${path}`, {
        headers: githubHeaders(pat),
    });
    if (!response.ok) {
        // Deliberately never include the Authorization header or the PAT
        // itself in this message -- it can end up in lastSyncError.
        throw new Error(describeGithubError(response.status, path));
    }
    return response;
}

/**
 * Map a GitHub status to something actionable.
 *
 * Previously every failure was reported as "check the token", which sent people
 * auditing PAT scopes over a 409 -- a status GitHub uses on the git-data
 * endpoints to mean the repository has no commits yet, nothing to do with auth.
 */
export function describeGithubError(status: number, path: string): string {
    const prefix = `GitHub respondió ${status} para ${path}.`;

    switch (status) {
        case 409:
            return `${prefix} El repositorio existe pero está vacío (sin commits), así que la rama indicada todavía no existe. Haz un primer push del contenido del curso antes de importar. No es un problema del token.`;
        case 404:
            return `${prefix} No se encontró el repositorio o la rama. Revisa el owner, el nombre del repositorio y la rama; si el repositorio es privado, comprueba también que el token tenga acceso a ese repositorio (GitHub responde 404, no 403, cuando el token no lo ve).`;
        case 401:
            return `${prefix} El token no es válido o expiró. Genera uno nuevo y vuelve a guardarlo.`;
        case 403:
            return `${prefix} El token es válido pero no tiene permiso suficiente (falta el permiso de lectura de contenido, o la organización requiere autorización SSO para el token).`;
        case 429:
            return `${prefix} Se alcanzó el límite de peticiones de la API de GitHub. Espera unos minutos y vuelve a intentarlo.`;
        default:
            if (status >= 500) {
                return `${prefix} Error temporal de GitHub. Vuelve a intentarlo en unos minutos.`;
            }
            return `${prefix} Verifica el token (permisos, expiración) y que el repositorio/rama existan.`;
    }
}

export async function fetchRepoFiles(
    owner: string,
    repo: string,
    ref: string,
    basePath: string,
    pat: string
): Promise<RepoFile[]> {
    const treePath = `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    const treeResponse = await fetch(`https://api.github.com${treePath}`, {
        headers: githubHeaders(pat),
    });
    if (treeResponse.status === 409) {
        // GitHub's documented "Git Repository is empty." -- no commits yet.
        throw new CourseImportEmptyError('repo', describeGithubError(409, treePath));
    }
    if (!treeResponse.ok) {
        throw new Error(describeGithubError(treeResponse.status, treePath));
    }
    const tree = (await treeResponse.json()) as GitTreeResponse;

    if (tree.truncated) {
        throw new Error(
            'El árbol del repositorio es demasiado grande para listarse en una sola llamada. Reduce el tamaño del repositorio o del curso.'
        );
    }

    const normalizedBase = basePath.replace(/^\/+|\/+$/g, '');
    const prefix = normalizedBase ? `${normalizedBase}/` : '';

    // Beyond scoping to basePath, only fetch blobs that could plausibly be
    // course.yaml, module.yaml, or a lesson file -- this is a bandwidth
    // optimization, not the source of truth for what's a valid lesson.
    // parseCourseTree still applies its own folder-structure logic and
    // rejects/ignores anything that isn't actually a real course file.
    const blobs = tree.tree.filter(
        (entry) =>
            entry.type === 'blob' &&
            (prefix === '' || entry.path.startsWith(prefix)) &&
            /\.(ya?ml|md)$/i.test(entry.path.split('/').pop() ?? '')
    );

    if (blobs.length === 0) {
        throw new CourseImportEmptyError(
            'path',
            `No se encontraron archivos en "${basePath || '/'}" para ${owner}/${repo}@${ref}.`
        );
    }

    return Promise.all(
        blobs.map(async (entry) => {
            const blobResponse = await githubFetch(`/repos/${owner}/${repo}/git/blobs/${entry.sha}`, pat);
            const blob = (await blobResponse.json()) as GitBlobResponse;
            const content =
                blob.encoding === 'base64' ? Buffer.from(blob.content, 'base64').toString('utf8') : blob.content;
            return { path: entry.path, content };
        })
    );
}

export function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const trimmed = repoUrl.trim().replace(/\.git$/, '').replace(/\/+$/, '');
    const match = trimmed.match(/github\.com[/:]([^/]+)\/([^/]+)$/) ?? trimmed.match(/^([^/]+)\/([^/]+)$/);
    if (!match) {
        throw new Error(`No se pudo interpretar la URL del repositorio: "${repoUrl}". Usa "owner/repo" o una URL de GitHub.`);
    }
    return { owner: match[1], repo: match[2] };
}

interface GitRefResponse {
    object: { sha: string };
}

interface GitCommitResponse {
    sha: string;
    tree: { sha: string };
}

async function githubPost<T>(path: string, pat: string, body: unknown): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
        method: 'POST',
        headers: { ...githubHeaders(pat), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(describeGithubWriteError(response.status, path));
    }
    return (await response.json()) as T;
}

/**
 * Write-specific guidance. A 403 here almost always means the fine-grained PAT
 * was granted "Read access to code" but not "Read and Write" -- naming that
 * precisely saves the user from re-auditing every other setting.
 */
export function describeGithubWriteError(status: number, path: string): string {
    if (status === 403) {
        return `GitHub respondió 403 para ${path}. El token no puede escribir en el repositorio: necesita el permiso "Read and Write access to code" (actualmente parece ser solo de lectura). Cámbialo en la configuración del token y vuelve a intentarlo.`;
    }
    if (status === 422) {
        return `GitHub respondió 422 para ${path}. La rama ya fue modificada por otra persona mientras se creaba la plantilla. Vuelve a intentarlo.`;
    }
    return describeGithubError(status, path);
}

/**
 * Commit `files` to `ref` as a SINGLE commit, using the Git Data API.
 *
 * Handles both an empty repository (no commits: the commit gets no parents and
 * the ref is created) and one with history (the new commit is stacked on the
 * current head and the ref is updated). The Contents API was rejected for this:
 * it writes one commit per file and leaves the repo half-populated if it fails
 * partway through.
 */
export async function commitFiles(
    owner: string,
    repo: string,
    ref: string,
    files: RepoFile[],
    message: string,
    pat: string
): Promise<{ commitSha: string }> {
    const base = `/repos/${owner}/${repo}/git`;

    // Does the branch already exist? 409/404 here means an empty repository.
    let headSha: string | null = null;
    let baseTreeSha: string | null = null;
    const refResponse = await fetch(`https://api.github.com${base}/ref/heads/${encodeURIComponent(ref)}`, {
        headers: githubHeaders(pat),
    });
    if (refResponse.ok) {
        headSha = ((await refResponse.json()) as GitRefResponse).object.sha;
        const commitResponse = await fetch(`https://api.github.com${base}/commits/${headSha}`, {
            headers: githubHeaders(pat),
        });
        if (commitResponse.ok) {
            baseTreeSha = ((await commitResponse.json()) as GitCommitResponse).tree.sha;
        }
    } else if (refResponse.status !== 404 && refResponse.status !== 409) {
        throw new Error(describeGithubError(refResponse.status, `${base}/ref/heads/${ref}`));
    }

    const blobs = await Promise.all(
        files.map(async (file) => {
            const blob = await githubPost<{ sha: string }>(`${base}/blobs`, pat, {
                content: Buffer.from(file.content, 'utf8').toString('base64'),
                encoding: 'base64',
            });
            return { path: file.path, sha: blob.sha };
        })
    );

    const tree = await githubPost<{ sha: string }>(`${base}/trees`, pat, {
        ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
        tree: blobs.map((blob) => ({
            path: blob.path,
            mode: '100644',
            type: 'blob',
            sha: blob.sha,
        })),
    });

    const commit = await githubPost<{ sha: string }>(`${base}/commits`, pat, {
        message,
        tree: tree.sha,
        parents: headSha ? [headSha] : [],
    });

    if (headSha) {
        const update = await fetch(`https://api.github.com${base}/refs/heads/${encodeURIComponent(ref)}`, {
            method: 'PATCH',
            headers: { ...githubHeaders(pat), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sha: commit.sha }),
        });
        if (!update.ok) {
            throw new Error(describeGithubWriteError(update.status, `${base}/refs/heads/${ref}`));
        }
    } else {
        await githubPost(`${base}/refs`, pat, {
            ref: `refs/heads/${ref}`,
            sha: commit.sha,
        });
    }

    return { commitSha: commit.sha };
}
