import type { ExistingLesson, ExistingModule, ImportPlan, ParsedCourse } from './types';

export function computePlan(
	parsed: ParsedCourse,
	existingModules: ExistingModule[],
	existingLessons: ExistingLesson[]
): ImportPlan {
	const existingModuleByPath = new Map(existingModules.map((m) => [m.sourcePath, m]));
	const parsedModulePaths = new Set(parsed.modules.map((m) => m.sourcePath));

	const modulesToCreate = parsed.modules.filter((m) => !existingModuleByPath.has(m.sourcePath));
	const modulesToUpdate = parsed.modules
		.filter((m) => existingModuleByPath.has(m.sourcePath))
		.map((m) => ({
			convexId: existingModuleByPath.get(m.sourcePath)!.convexId,
			sourcePath: m.sourcePath,
			title: m.title,
			order: m.order,
		}));
	const modulesToDelete = existingModules
		.filter((m) => !parsedModulePaths.has(m.sourcePath))
		.map((m) => m.convexId);

	const existingLessonByPath = new Map(existingLessons.map((l) => [l.sourcePath, l]));
	const parsedLessonPaths = new Set<string>();

	const lessonsToCreate: ImportPlan['lessonsToCreate'] = [];
	const lessonsToUpdate: ImportPlan['lessonsToUpdate'] = [];
	let lessonsToSkip = 0;

	for (const mod of parsed.modules) {
		for (const lesson of mod.lessons) {
			parsedLessonPaths.add(lesson.sourcePath);
			const existing = existingLessonByPath.get(lesson.sourcePath);
			if (!existing) {
				lessonsToCreate.push({ moduleSourcePath: mod.sourcePath, lesson });
			} else if (existing.sourceHash !== lesson.sourceHash) {
				lessonsToUpdate.push({ convexId: existing.convexId, lesson });
			} else {
				lessonsToSkip += 1;
			}
		}
	}

	const lessonsToDelete = existingLessons
		.filter((l) => !parsedLessonPaths.has(l.sourcePath))
		.map((l) => l.convexId);

	return {
		modulesToCreate,
		modulesToUpdate,
		modulesToDelete,
		lessonsToCreate,
		lessonsToUpdate,
		lessonsToSkip,
		lessonsToDelete,
	};
}
