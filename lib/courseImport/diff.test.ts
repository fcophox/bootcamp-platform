import { describe, it, expect } from 'vitest';
import { computePlan } from './diff';
import type { ParsedCourse } from './types';

function course(modules: ParsedCourse['modules']): ParsedCourse {
	return {
		title: 'T',
		description: 'D',
		duration: '1',
		level: 'Intermedio',
		startDate: '2026-01-01',
		icon: 'code',
		color: 'green',
		enableChecklist: true,
		enableRanking: true,
		modules,
	};
}

describe('computePlan', () => {
	it('treats everything as a create when there is no existing state', () => {
		const plan = computePlan(
			course([
				{
					sourcePath: 'modules/01-a',
					title: 'A',
					order: 1,
					lessons: [{ sourcePath: 'modules/01-a/01-l.md', title: 'L', type: 'text', order: 1, content: '{}', sourceHash: 'h1' }],
				},
			]),
			[],
			[]
		);
		expect(plan.modulesToCreate).toHaveLength(1);
		expect(plan.lessonsToCreate).toHaveLength(1);
		expect(plan.modulesToUpdate).toHaveLength(0);
		expect(plan.lessonsToSkip).toBe(0);
	});

	it('skips a lesson whose hash is unchanged', () => {
		const plan = computePlan(
			course([
				{
					sourcePath: 'modules/01-a',
					title: 'A',
					order: 1,
					lessons: [{ sourcePath: 'modules/01-a/01-l.md', title: 'L', type: 'text', order: 1, content: '{}', sourceHash: 'h1' }],
				},
			]),
			[{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
			[{ convexId: 'les1', sourcePath: 'modules/01-a/01-l.md', sourceHash: 'h1' }]
		);
		expect(plan.lessonsToSkip).toBe(1);
		expect(plan.lessonsToCreate).toHaveLength(0);
		expect(plan.lessonsToUpdate).toHaveLength(0);
	});

	it('updates a lesson whose hash changed', () => {
		const plan = computePlan(
			course([
				{
					sourcePath: 'modules/01-a',
					title: 'A',
					order: 1,
					lessons: [{ sourcePath: 'modules/01-a/01-l.md', title: 'L', type: 'text', order: 1, content: '{}', sourceHash: 'h2' }],
				},
			]),
			[{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
			[{ convexId: 'les1', sourcePath: 'modules/01-a/01-l.md', sourceHash: 'h1' }]
		);
		expect(plan.lessonsToUpdate).toEqual([
			{ convexId: 'les1', lesson: expect.objectContaining({ sourceHash: 'h2' }) },
		]);
	});

	it('deletes a module and its lessons no longer present in the repo', () => {
		const plan = computePlan(
			course([]),
			[{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
			[{ convexId: 'les1', sourcePath: 'modules/01-a/01-l.md', sourceHash: 'h1' }]
		);
		expect(plan.modulesToDelete).toEqual(['mod1']);
		expect(plan.lessonsToDelete).toEqual(['les1']);
	});

	it('deletes one lesson within a module that otherwise still exists', () => {
		const plan = computePlan(
			course([{ sourcePath: 'modules/01-a', title: 'A', order: 1, lessons: [] }]),
			[{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
			[{ convexId: 'les1', sourcePath: 'modules/01-a/01-l.md', sourceHash: 'h1' }]
		);
		expect(plan.modulesToDelete).toHaveLength(0);
		expect(plan.lessonsToDelete).toEqual(['les1']);
	});

	it('always includes an existing module in modulesToUpdate, even with no field changes', () => {
		const plan = computePlan(
			course([{ sourcePath: 'modules/01-a', title: 'A', order: 1, lessons: [] }]),
			[{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
			[]
		);
		expect(plan.modulesToUpdate).toEqual([{ convexId: 'mod1', sourcePath: 'modules/01-a', title: 'A', order: 1 }]);
	});
});
