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

const GITHUB_API_ORIGIN = 'https://api.github.com';
const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const GITHUB_REPO_PATTERN = /^[A-Za-z0-9._-]+$/;
const GITHUB_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const INVALID_GIT_REF_CHARS = /[\x00-\x20\x7f~^:?*\[\\]/;

function githubApiUrl(path: string): URL {
    if (!path.startsWith('/')) {
        throw new Error('GitHub API path must start with /.');
    }

    const url = new URL(path, GITHUB_API_ORIGIN);
    if (url.origin !== GITHUB_API_ORIGIN) {
        throw new Error('GitHub API URL must target api.github.com.');
    }

    return url;
}

function githubRepoPath(owner: string, repo: string): string {
    if (!GITHUB_OWNER_PATTERN.test(owner)) {
        throw new Error('Owner de GitHub inválido.');
    }
    if (!GITHUB_REPO_PATTERN.test(repo) || repo === '.' || repo === '..') {
        throw new Error('Repositorio de GitHub inválido.');
    }

    return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function encodeGitRef(ref: string): string {
    if (
        !ref ||
        ref === '@' ||
        ref.startsWith('/') ||
        ref.endsWith('/') ||
        ref.endsWith('.') ||
        ref.includes('..') ||
        ref.includes('//') ||
        ref.includes('@{') ||
        INVALID_GIT_REF_CHARS.test(ref) ||
        ref.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock'))
    ) {
        throw new Error('Rama de GitHub inválida.');
    }

    return encodeURIComponent(ref);
}

function encodeGitSha(sha: string): string {
    if (!GITHUB_SHA_PATTERN.test(sha)) {
        throw new Error('SHA de GitHub inválido.');
    }

    return encodeURIComponent(sha);
}

function encodeGithubFilePath(path: string): string {
    const parts = path.split('/');
    if (
        !path ||
        path.startsWith('/') ||
        path.endsWith('/') ||
        parts.some((part) => part === '' || part === '.' || part === '..' || /[\x00-\x1f\x7f]/.test(part))
    ) {
        throw new Error('Ruta de archivo inválida para GitHub.');
    }

    return parts.map((part) => encodeURIComponent(part)).join('/');
}

function githubHeaders(pat: string): Record<string, string> {
    return {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

async function githubFetch(path: string, pat: string): Promise<Response> {
    const response = await fetch(githubApiUrl(path), {
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
    const repoPath = githubRepoPath(owner, repo);
    const treePath = `${repoPath}/git/trees/${encodeGitRef(ref)}?recursive=1`;
    const treeResponse = await fetch(githubApiUrl(treePath), {
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
            const blobResponse = await githubFetch(`${repoPath}/git/blobs/${encodeGitSha(entry.sha)}`, pat);
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
    githubRepoPath(match[1], match[2]);
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
    const response = await fetch(githubApiUrl(path), {
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

async function githubPut<T>(path: string, pat: string, body: unknown): Promise<T> {
    const response = await fetch(githubApiUrl(path), {
        method: 'PUT',
        headers: { ...githubHeaders(pat), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(describeGithubWriteError(response.status, path));
    }
    return (await response.json()) as T;
}

/**
 * Commit `files` to `ref` as a single commit.
 *
 * The Git Data API (blobs/trees) answers 409 "Git Repository is empty." until a
 * repository has at least one commit -- verified against the live API, not
 * assumed. So a repo with no commits is bootstrapped through the Contents API
 * (the only write endpoint that works there), which creates the branch, and the
 * resulting commit is then REPLACED by a parentless commit holding exactly the
 * requested files. History ends up as one clean commit and the bootstrap is
 * left unreferenced.
 *
 * A repo that already has history takes the plain path: stack a commit on the
 * current head and fast-forward the ref.
 *
 * The bootstrap writes the first requested file rather than a placeholder, so
 * even a failure partway through leaves a legitimate file instead of junk.
 */
export async function commitFiles(
    owner: string,
    repo: string,
    ref: string,
    files: RepoFile[],
    message: string,
    pat: string
): Promise<{ commitSha: string }> {
    if (files.length === 0) {
        throw new Error('No hay archivos que enviar al repositorio.');
    }

    const repoPath = githubRepoPath(owner, repo);
    const base = `${repoPath}/git`;

    let headSha: string | null = null;
    let baseTreeSha: string | null = null;
    const encodedRef = encodeGitRef(ref);
    const refResponse = await fetch(githubApiUrl(`${base}/ref/heads/${encodedRef}`), {
        headers: githubHeaders(pat),
    });
    if (refResponse.ok) {
        headSha = ((await refResponse.json()) as GitRefResponse).object.sha;
        const commitResponse = await fetch(githubApiUrl(`${base}/commits/${headSha}`), {
            headers: githubHeaders(pat),
        });
        if (commitResponse.ok) {
            baseTreeSha = ((await commitResponse.json()) as GitCommitResponse).tree.sha;
        }
    } else if (refResponse.status !== 404 && refResponse.status !== 409) {
        throw new Error(describeGithubError(refResponse.status, `${base}/ref/heads/${ref}`));
    }

    // Empty repository: unlock the Git Data endpoints.
    const bootstrapped = headSha === null;
    if (bootstrapped) {
        await githubPut(`${repoPath}/contents/${encodeGithubFilePath(files[0].path)}`, pat, {
            message,
            content: Buffer.from(files[0].content, 'utf8').toString('base64'),
            branch: ref,
        });
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
        // Parentless on a freshly bootstrapped repo so the bootstrap commit is
        // replaced rather than stacked on.
        parents: headSha ? [headSha] : [],
    });

    if (headSha || bootstrapped) {
        const update = await fetch(githubApiUrl(`${base}/refs/heads/${encodedRef}`), {
            method: 'PATCH',
            headers: { ...githubHeaders(pat), 'Content-Type': 'application/json' },
            // force only when discarding the bootstrap commit we just made
            // ourselves seconds ago -- never over a user's existing history.
            body: JSON.stringify({ sha: commit.sha, ...(bootstrapped ? { force: true } : {}) }),
        });
        if (!update.ok) {
            throw new Error(describeGithubWriteError(update.status, `${base}/refs/heads/${ref}`));
        }
    } else {
        await githubPost(`${base}/refs`, pat, { ref: `refs/heads/${ref}`, sha: commit.sha });
    }

    return { commitSha: commit.sha };
}
