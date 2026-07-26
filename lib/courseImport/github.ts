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
        throw new Error(
            `GitHub respondió ${response.status} para ${path}. Verifica el token (permisos, expiración) y que el repositorio/rama existan.`
        );
    }
    return response;
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
