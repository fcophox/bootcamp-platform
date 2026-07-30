import 'server-only';
import type { RepoFile } from './types';

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

async function githubFetch(path: string, pat: string): Promise<Response> {
    const response = await fetch(`https://api.github.com${path}`, {
        headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
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
    const treeResponse = await githubFetch(
        `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
        pat
    );
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
        throw new Error(`No se encontraron archivos en "${basePath || '/'}" para ${owner}/${repo}@${ref}.`);
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
