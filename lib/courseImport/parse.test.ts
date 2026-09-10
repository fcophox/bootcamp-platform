import { describe, it, expect } from 'vitest';
import { parseCourseTree } from './parse';
import type { RepoFile } from './types';

function files(entries: Record<string, string>): RepoFile[] {
	return Object.entries(entries).map(([path, content]) => ({ path, content }));
}

const COURSE_YAML = `
title: "Bootcamp de Prueba"
description: "Un curso de prueba"
duration: "4 semanas"
level: "Intermedio"
startDate: "2026-09-01"
icon: "database"
color: "blue"
`;

describe('parseCourseTree', () => {
	it('parses course.yaml and derives order/title from numeric prefixes', () => {
		const result = parseCourseTree(
			files({
				'course.yaml': COURSE_YAML,
				'modules/01-introduccion/01-bienvenida.md': '---\ntitle: Bienvenida\ntype: text\n---\n\nHola',
			}),
			''
		);

		expect(result.title).toBe('Bootcamp de Prueba');
		expect(result.icon).toBe('database');
		expect(result.modules).toHaveLength(1);
		expect(result.modules[0].sourcePath).toBe('modules/01-introduccion');
		expect(result.modules[0].order).toBe(1);
		expect(result.modules[0].title).toBe('Introduccion');
		expect(result.modules[0].lessons).toHaveLength(1);
		expect(result.modules[0].lessons[0].title).toBe('Bienvenida');
	});

	it('respects module.yaml title override', () => {
		const result = parseCourseTree(
			files({
				'course.yaml': COURSE_YAML,
				'modules/01-intro/module.yaml': 'title: "Título Personalizado"',
				'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
			}),
			''
		);
		expect(result.modules[0].title).toBe('Título Personalizado');
	});

	it('converts a text lesson body from markdown to HTML', () => {
		const result = parseCourseTree(
			files({
				'course.yaml': COURSE_YAML,
				'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\n# Título\n\nParrafo.',
			}),
			''
		);
		const content = JSON.parse(result.modules[0].lessons[0].content);
		expect(content.html).toContain('<h1>Título</h1>');
		expect(content.imageUrl).toBe('');
	});

	it('produces { url, html } for a video lesson', () => {
		const result = parseCourseTree(
			files({
				'course.yaml': COURSE_YAML,
				'modules/01-intro/01-a.md':
					'---\ntitle: Video\ntype: video\nurl: "https://example.com/v.mp4"\n---\n\nDescripcion.',
			}),
			''
		);
		const content = JSON.parse(result.modules[0].lessons[0].content);
		expect(content.url).toBe('https://example.com/v.mp4');
		expect(content.html).toContain('Descripcion');
	});

	it('throws when a video lesson is missing url', () => {
		expect(() =>
			parseCourseTree(
				files({
					'course.yaml': COURSE_YAML,
					'modules/01-intro/01-a.md': '---\ntitle: Video\ntype: video\n---\n\nX',
				}),
				''
			)
		).toThrow('requieren "url"');
	});

	it('produces { questions, settings } for an exam lesson', () => {
		const result = parseCourseTree(
			files({
				'course.yaml': COURSE_YAML,
				'modules/01-intro/01-quiz.yaml': `
title: "Quiz"
type: exam
settings:
  duration: 20
questions:
  - text: "Pregunta 1"
    explanation: "Porque A es la alternativa correcta."
    options:
      - text: "A"
        correct: true
      - text: "B"
        correct: false
`,
			}),
			''
		);
		const content = JSON.parse(result.modules[0].lessons[0].content);
		expect(content.settings.duration).toBe(20);
		expect(content.questions).toHaveLength(1);
		expect(content.questions[0].explanation).toBe('Porque A es la alternativa correcta.');
		expect(content.questions[0].options[0].isCorrect).toBe(true);
	});

	it('throws on an unrecognized lesson type instead of silently dropping it', () => {
		expect(() =>
			parseCourseTree(
				files({
					'course.yaml': COURSE_YAML,
					'modules/01-intro/01-a.md': '---\ntitle: X\ntype: subtitle\n---\n\nX',
				}),
				''
			)
		).toThrow('no reconocido');
	});

	it('coerces an unquoted startDate (parsed by js-yaml as a Date) to a YYYY-MM-DD string', () => {
		const result = parseCourseTree(
			files({
				'course.yaml': `
title: "Bootcamp de Prueba"
description: "Un curso de prueba"
duration: "4 semanas"
level: "Intermedio"
startDate: 2026-09-01
icon: "database"
color: "blue"
`,
				'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
			}),
			''
		);

		expect(typeof result.startDate).toBe('string');
		expect(result.startDate).toBe('2026-09-01');
	});

	it('throws when course.yaml is missing', () => {
		expect(() => parseCourseTree(files({}), '')).toThrow('course.yaml');
	});

	it('throws when a required course.yaml field is missing', () => {
		expect(() =>
			parseCourseTree(files({ 'course.yaml': 'title: "Solo título"' }), '')
		).toThrow('description');
	});

	it('scopes parsing to the given basePath', () => {
		const result = parseCourseTree(
			files({
				'other-course/course.yaml': 'title: Ignorar\ndescription: x\nduration: x\nlevel: x\nstartDate: x',
				'cursos/data-eng/course.yaml': COURSE_YAML,
				'cursos/data-eng/modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
			}),
			'cursos/data-eng'
		);
		expect(result.title).toBe('Bootcamp de Prueba');
	});

	it('produces a stable hash for identical content and a different one when content changes', () => {
		const a = parseCourseTree(
			files({
				'course.yaml': COURSE_YAML,
				'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
			}),
			''
		);
		const b = parseCourseTree(
			files({
				'course.yaml': COURSE_YAML,
				'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
			}),
			''
		);
		const c = parseCourseTree(
			files({
				'course.yaml': COURSE_YAML,
				'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nY',
			}),
			''
		);
		expect(a.modules[0].lessons[0].sourceHash).toBe(b.modules[0].lessons[0].sourceHash);
		expect(a.modules[0].lessons[0].sourceHash).not.toBe(c.modules[0].lessons[0].sourceHash);
	});
});
