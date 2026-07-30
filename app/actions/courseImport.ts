'use server';

import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { revalidatePath } from 'next/cache';
import { encryptPat, decryptPat } from '@/utils/crypto';
import { CourseImportEmptyError, commitFiles, fetchRepoFiles, parseRepoUrl } from '@/lib/courseImport/github';
import { TEMPLATE_COMMIT_MESSAGE, TEMPLATE_FILES, normalizeBasePath, readTemplateFilesAt } from '@/lib/courseImport/template';
import { parseCourseTree } from '@/lib/courseImport/parse';
import { computePlan } from '@/lib/courseImport/diff';
import { summarizePlan } from '@/lib/courseImport/types';
import type { ImportPlan, ParsedCourse, PlanImportResult } from '@/lib/courseImport/types';

// Distinguishes an authorization rejection from any other failure so the
// resync catch blocks below can skip tryRecordFailure for it -- an
// unauthorized caller should never be able to write lastSyncStatus/
// lastSyncError onto a bootcamp it wasn't allowed to touch in the first
// place.
class AuthorizationError extends Error {}

async function requireDocenteOrSuperadmin(): Promise<{ token: string }> {
    const token = await convexAuthNextjsToken();
    if (!token) {
        throw new AuthorizationError('No autorizado');
    }
    const currentUser = await fetchQuery(api.users.getCurrentUserWithRole, {}, { token });
    if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'docente')) {
        throw new AuthorizationError('No tienes permisos para importar cursos');
    }
    return { token };
}

export interface EmptySourceResult {
    empty: {
        kind: 'repo' | 'path';
        message: string;
        templateFiles: string[];
        commitMessage: string;
        ref: string;
        path: string;
    };
}

export async function planImportFromRepo(input: {
    repoUrl: string;
    path: string;
    ref: string;
    pat: string;
}): Promise<{ error: string } | EmptySourceResult | PlanImportResult> {
    try {
        await requireDocenteOrSuperadmin();
        const { owner, repo } = parseRepoUrl(input.repoUrl);
        const files = await fetchRepoFiles(owner, repo, input.ref || 'main', input.path, input.pat);
        const course = parseCourseTree(files, input.path);
        // No existing state on initial import -- everything is a create.
        const plan = computePlan(course, [], []);
        return { course, plan, summary: summarizePlan(plan) };
    } catch (err) {
        // There is genuinely nothing to import: offer to seed the template
        // rather than dead-ending the user. Parse failures are NOT this.
        if (err instanceof CourseImportEmptyError) {
            const normalized = normalizeBasePath(input.path);
            return {
                empty: {
                    kind: err.kind,
                    message: err.message,
                    templateFiles: TEMPLATE_FILES.map((f) => (normalized ? `${normalized}/${f}` : f)),
                    commitMessage: TEMPLATE_COMMIT_MESSAGE,
                    ref: input.ref || 'main',
                    path: normalized,
                },
            };
        }
        return { error: err instanceof Error ? err.message : 'Error al analizar el repositorio' };
    }
}

/**
 * Commit the starter template into an empty repository/path so the import can
 * proceed. Only ever called after the user confirms in the UI -- an import
 * attempt must never write to someone's repo on its own.
 */
export async function createTemplateInRepo(input: {
    repoUrl: string;
    path: string;
    ref: string;
    pat: string;
}): Promise<{ error: string } | { ok: true; commitSha: string }> {
    try {
        await requireDocenteOrSuperadmin();
        const { owner, repo } = parseRepoUrl(input.repoUrl);
        const files = await readTemplateFilesAt(input.path);
        const { commitSha } = await commitFiles(
            owner,
            repo,
            input.ref || 'main',
            files,
            TEMPLATE_COMMIT_MESSAGE,
            input.pat
        );
        return { ok: true, commitSha };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'No se pudo crear la plantilla en el repositorio' };
    }
}

export async function applyImportPlan(input: {
    course: ParsedCourse;
    plan: ImportPlan;
    connection: { repoUrl: string; path: string; ref: string; pat: string };
}): Promise<{ error: string } | { bootcampId: string }> {
    try {
        const { token } = await requireDocenteOrSuperadmin();
        const { owner, repo } = parseRepoUrl(input.connection.repoUrl);

        const result = await fetchMutation(
            api.courseImport.applyImport,
            {
                course: toApplyCourse(input.course),
                connection: {
                    sourceRepo: `${owner}/${repo}`,
                    sourcePath: input.connection.path,
                    sourceRef: input.connection.ref || 'main',
                    sourcePatEncrypted: encryptPat(input.connection.pat),
                },
                ...toApplyLists(input.plan),
            },
            { token }
        );

        revalidatePath('/cms');
        return { bootcampId: result.bootcampId };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error al importar el curso' };
    }
}

export async function planResync(bootcampId: string): Promise<{ error: string } | PlanImportResult> {
    try {
        const { token } = await requireDocenteOrSuperadmin();
        const meta = await fetchQuery(api.courseImport.getBootcampSyncMeta, { bootcampId: bootcampId as never }, { token });
        if (!meta || !meta.sourceRepo || !meta.sourcePath || !meta.sourceRef || !meta.sourcePatEncrypted) {
            throw new Error('Este bootcamp no está conectado a un repositorio');
        }

        const [owner, repo] = meta.sourceRepo.split('/');
        const pat = decryptPat(meta.sourcePatEncrypted);
        const files = await fetchRepoFiles(owner, repo, meta.sourceRef, meta.sourcePath, pat);
        const course = parseCourseTree(files, meta.sourcePath);

        const syncState = await fetchQuery(api.courseImport.getSyncState, { bootcampId: bootcampId as never }, { token });
        const plan = computePlan(course, syncState.modules, syncState.lessons);

        return { course, plan, summary: summarizePlan(plan) };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al sincronizar el curso';
        // Don't record a sync failure for an authorization rejection itself
        // -- the caller was never authorized to touch this bootcamp.
        if (!(err instanceof AuthorizationError)) {
            await tryRecordFailure(bootcampId, message);
        }
        return { error: message };
    }
}

export async function applyResync(input: {
    bootcampId: string;
    course: ParsedCourse;
    plan: ImportPlan;
}): Promise<{ error: string } | { bootcampId: string }> {
    try {
        const { token } = await requireDocenteOrSuperadmin();
        const result = await fetchMutation(
            api.courseImport.applyImport,
            {
                bootcampId: input.bootcampId as never,
                course: toApplyCourse(input.course),
                ...toApplyLists(input.plan),
            },
            { token }
        );
        revalidatePath(`/cms/bootcamp/${input.bootcampId}/manage`);
        return { bootcampId: result.bootcampId };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al importar el curso';
        // Don't record a sync failure for an authorization rejection itself
        // -- the caller was never authorized to touch this bootcamp.
        if (!(err instanceof AuthorizationError)) {
            await tryRecordFailure(input.bootcampId, message);
        }
        return { error: message };
    }
}

export async function reconnectRepo(input: {
    bootcampId: string;
    pat: string;
}): Promise<{ error: string } | { success: true }> {
    try {
        const { token } = await requireDocenteOrSuperadmin();
        await fetchMutation(
            api.courseImport.updatePatConnection,
            { bootcampId: input.bootcampId as never, sourcePatEncrypted: encryptPat(input.pat) },
            { token },
        );
        revalidatePath(`/cms/bootcamp/${input.bootcampId}/manage`);
        return { success: true };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error al actualizar el token de acceso' };
    }
}

async function tryRecordFailure(bootcampId: string, message: string): Promise<void> {
    try {
        const token = await convexAuthNextjsToken();
        if (!token) return;
        await fetchMutation(api.courseImport.recordSyncFailure, { bootcampId: bootcampId as never, error: message }, { token });
    } catch {
        // Best-effort -- if even recording the failure fails, the caller
        // already has the error message to show.
    }
}

function toApplyCourse(course: ParsedCourse) {
    return {
        title: course.title,
        description: course.description,
        duration: course.duration,
        level: course.level,
        startDate: course.startDate,
        icon: course.icon,
        color: course.color,
        enableChecklist: course.enableChecklist,
        enableRanking: course.enableRanking,
    };
}

function toApplyLists(plan: ImportPlan) {
    return {
        modulesToCreate: plan.modulesToCreate.map((m) => ({ sourcePath: m.sourcePath, title: m.title, order: m.order })),
        modulesToUpdate: plan.modulesToUpdate.map((m) => ({
            convexId: m.convexId as never,
            sourcePath: m.sourcePath,
            title: m.title,
            order: m.order,
        })),
        modulesToDelete: plan.modulesToDelete.map((id) => id as never),
        lessonsToCreate: plan.lessonsToCreate.map((l) => ({
            moduleSourcePath: l.moduleSourcePath,
            sourcePath: l.lesson.sourcePath,
            title: l.lesson.title,
            type: l.lesson.type,
            order: l.lesson.order,
            content: l.lesson.content,
            sourceHash: l.lesson.sourceHash,
        })),
        lessonsToUpdate: plan.lessonsToUpdate.map((l) => ({
            convexId: l.convexId as never,
            title: l.lesson.title,
            type: l.lesson.type,
            order: l.lesson.order,
            content: l.lesson.content,
            sourceHash: l.lesson.sourceHash,
        })),
        lessonsToDelete: plan.lessonsToDelete.map((id) => id as never),
    };
}
