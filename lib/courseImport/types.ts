export type LessonType = 'text' | 'video' | 'pdf' | 'podcast' | 'exam';

export const LESSON_TYPES: LessonType[] = ['text', 'video', 'pdf', 'podcast', 'exam'];

export interface RepoFile {
	path: string; // relative to repo root
	content: string; // utf8 text content
}

export interface ParsedLesson {
	sourcePath: string; // relative to repo root
	title: string;
	type: LessonType;
	order: number;
	content: string; // JSON string, matches lessons.content's existing shape per type
	sourceHash: string;
}

export interface ParsedModule {
	sourcePath: string; // relative to repo root
	title: string;
	order: number;
	lessons: ParsedLesson[];
}

export interface ParsedCourse {
	title: string;
	description: string;
	duration: string;
	level: string;
	startDate: string;
	icon: string;
	color: string;
	enableChecklist: boolean;
	enableRanking: boolean;
	modules: ParsedModule[];
}

export interface ExistingModule {
	convexId: string;
	sourcePath: string;
}

export interface ExistingLesson {
	convexId: string;
	sourcePath: string;
	sourceHash: string;
}

export interface ImportPlan {
	modulesToCreate: ParsedModule[];
	modulesToUpdate: Array<{ convexId: string; sourcePath: string; title: string; order: number }>;
	modulesToDelete: string[]; // convexIds
	lessonsToCreate: Array<{ moduleSourcePath: string; lesson: ParsedLesson }>;
	lessonsToUpdate: Array<{ convexId: string; lesson: ParsedLesson }>;
	lessonsToSkip: number;
	lessonsToDelete: string[]; // convexIds
}

export interface ImportPlanSummary {
	modulesToCreate: number;
	modulesToUpdate: number;
	modulesToDelete: number;
	lessonsToCreate: number;
	lessonsToUpdate: number;
	lessonsToSkip: number;
	lessonsToDelete: number;
}

export function summarizePlan(plan: ImportPlan): ImportPlanSummary {
	return {
		modulesToCreate: plan.modulesToCreate.length,
		modulesToUpdate: plan.modulesToUpdate.length,
		modulesToDelete: plan.modulesToDelete.length,
		lessonsToCreate: plan.lessonsToCreate.length,
		lessonsToUpdate: plan.lessonsToUpdate.length,
		lessonsToSkip: plan.lessonsToSkip,
		lessonsToDelete: plan.lessonsToDelete.length,
	};
}

export interface PlanImportResult {
	course: ParsedCourse;
	plan: ImportPlan;
	summary: ImportPlanSummary;
}
