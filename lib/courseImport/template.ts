import 'server-only';
import { readFile } from 'fs/promises';
import path from 'path';
import type { RepoFile } from './types';

/**
 * The starter course shipped with the platform.
 *
 * Single source of truth for BOTH the "Descargar plantilla .zip" download
 * (app/api/courses/template/route.ts) and the template committed into an empty
 * repository during import. Keeping one list stops the two from drifting.
 */
export const TEMPLATE_FILES = [
    // Documentation first: external authors never see the platform repository,
    // so the template has to be self-contained -- format reference, agent
    // contract and authoring skill all travel with the content.
    'README.md',
    'AGENTS.md',
    '.claude/skills/course-authoring/SKILL.md',

    'course.yaml',

    // A worked module demonstrating every lesson type the parser supports...
    'modules/01-fundamentos/module.yaml',
    'modules/01-fundamentos/01-bienvenida.md',
    'modules/01-fundamentos/02-video-introductorio.md',
    'modules/01-fundamentos/03-material-de-lectura.md',
    'modules/01-fundamentos/04-podcast-entrevista.md',
    'modules/01-fundamentos/05-evaluacion.yaml',

    // ...and a second module, so the numbering convention that orders them is
    // visible rather than described.
    'modules/02-practica/module.yaml',
    'modules/02-practica/01-ejercicio-guiado.md',
] as const;

export const TEMPLATE_COMMIT_MESSAGE = 'chore: plantilla inicial del curso';

function templateDir(): string {
    return path.join(process.cwd(), 'examples', 'course-template');
}

/** Read the template from disk, relative to the repo root (no base path applied). */
export async function readTemplateFiles(): Promise<RepoFile[]> {
    return Promise.all(
        TEMPLATE_FILES.map(async (relPath) => ({
            path: relPath,
            content: await readFile(path.join(templateDir(), relPath), 'utf8'),
        }))
    );
}

/**
 * Strip surrounding whitespace and slashes from a user-entered base path.
 * Whitespace matters: the path comes straight from a text input, and a
 * blank-looking "   " would otherwise produce paths like "   /course.yaml".
 */
export function normalizeBasePath(basePath: string): string {
    return basePath.trim().replace(/^\/+|\/+$/g, '').trim();
}

/**
 * Read the template with every path rebased under `basePath`, ready to commit
 * at the location the user configured for the import.
 */
export async function readTemplateFilesAt(basePath: string): Promise<RepoFile[]> {
    const normalized = normalizeBasePath(basePath);
    const files = await readTemplateFiles();
    if (!normalized) return files;
    return files.map((file) => ({ ...file, path: `${normalized}/${file.path}` }));
}
