import matter from 'gray-matter';
import { load as loadYaml } from 'js-yaml';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import { createHash } from 'crypto';
import {
	LESSON_TYPES,
	type LessonType,
	type ParsedCourse,
	type ParsedModule,
	type ParsedLesson,
	type RepoFile,
} from './types';

interface RawCourseYaml {
	title?: string;
	description?: string;
	duration?: string;
	level?: string;
	startDate?: string;
	icon?: string;
	color?: string;
	enableChecklist?: boolean;
	enableRanking?: boolean;
}

interface RawModuleYaml {
	title?: string;
}

interface RawExamQuestion {
	text?: string;
	options?: Array<{ text?: string; correct?: boolean }>;
}

interface RawExamYaml {
	title?: string;
	type?: string;
	settings?: { duration?: number };
	questions?: RawExamQuestion[];
}

const REQUIRED_COURSE_FIELDS = ['title', 'description', 'duration', 'level', 'startDate'] as const;

function computeHash(content: string): string {
	return createHash('sha256').update(content, 'utf8').digest('hex');
}

function markdownToHtml(markdown: string): string {
	return String(remark().use(remarkHtml).processSync(markdown));
}

function titleCase(slug: string): string {
	return slug
		.replace(/[-_]+/g, ' ')
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripNumericPrefix(name: string): { order: number; slugTitle: string } {
	const match = name.match(/^(\d+)-(.+)$/);
	if (!match) {
		return { order: 0, slugTitle: titleCase(name) };
	}
	return { order: parseInt(match[1], 10), slugTitle: titleCase(match[2]) };
}

function stripExtension(fileName: string): string {
	return fileName.replace(/\.(md|ya?ml)$/i, '');
}

export function parseCourseTree(files: RepoFile[], basePath: string): ParsedCourse {
	const normalizedBase = basePath.replace(/^\/+|\/+$/g, '');
	const prefix = normalizedBase ? `${normalizedBase}/` : '';

	const scoped = files
		.filter((f) => f.path.startsWith(prefix))
		.map((f) => ({ ...f, relPath: f.path.slice(prefix.length) }));

	const courseFile = scoped.find((f) => f.relPath === 'course.yaml');
	if (!courseFile) {
		throw new Error(`No se encontró course.yaml en "${basePath || '/'}"`);
	}

	const course = (loadYaml(courseFile.content) ?? {}) as RawCourseYaml;
	for (const field of REQUIRED_COURSE_FIELDS) {
		if (!course[field]) {
			throw new Error(`course.yaml: falta el campo requerido "${field}"`);
		}
	}

	const moduleFiles = scoped.filter((f) => f.relPath.startsWith('modules/'));
	const moduleFolders = new Map<string, typeof scoped>();
	for (const file of moduleFiles) {
		const parts = file.relPath.split('/'); // ['modules', '01-intro', '01-lesson.md']
		if (parts.length < 3) continue; // stray file directly under modules/, ignored
		const folder = parts[1];
		const list = moduleFolders.get(folder) ?? [];
		list.push(file);
		moduleFolders.set(folder, list);
	}

	const modules: ParsedModule[] = Array.from(moduleFolders.entries())
		.map(([folder, filesInFolder]) => parseModule(folder, filesInFolder))
		.sort((a, b) => a.order - b.order);

	return {
		title: course.title as string,
		description: course.description as string,
		duration: course.duration as string,
		level: course.level as string,
		startDate: course.startDate as string,
		icon: course.icon ?? 'code',
		color: course.color ?? 'green',
		enableChecklist: course.enableChecklist !== false,
		enableRanking: course.enableRanking !== false,
		modules,
	};
}

function parseModule(
	folder: string,
	files: Array<{ path: string; content: string; relPath: string }>
): ParsedModule {
	const { order, slugTitle } = stripNumericPrefix(folder);
	const modulePath = `modules/${folder}`;

	const moduleYamlFile = files.find((f) => f.relPath === `${modulePath}/module.yaml`);
	let title = slugTitle;
	if (moduleYamlFile) {
		const parsed = (loadYaml(moduleYamlFile.content) ?? {}) as RawModuleYaml;
		if (parsed.title) title = parsed.title;
	}

	const lessonFiles = files.filter(
		(f) => f.relPath !== `${modulePath}/module.yaml` && f.relPath.startsWith(`${modulePath}/`)
	);

	const lessons = lessonFiles.map(parseLesson).sort((a, b) => a.order - b.order);

	return { sourcePath: modulePath, title, order, lessons };
}

function parseLesson(file: { path: string; content: string; relPath: string }): ParsedLesson {
	const fileName = file.relPath.split('/').pop() as string;
	const { order, slugTitle } = stripNumericPrefix(stripExtension(fileName));
	const sourceHash = computeHash(file.content);
	const isYaml = /\.ya?ml$/i.test(fileName);

	if (isYaml) {
		return parseExamLesson(file.relPath, file.content, order, slugTitle, sourceHash);
	}
	return parseMarkdownLesson(file.relPath, file.content, order, slugTitle, sourceHash);
}

function parseExamLesson(
	relPath: string,
	rawContent: string,
	order: number,
	slugTitle: string,
	sourceHash: string
): ParsedLesson {
	const parsed = (loadYaml(rawContent) ?? {}) as RawExamYaml;
	if (parsed.type !== 'exam') {
		throw new Error(
			`${relPath}: los archivos .yaml de lección solo soportan type: exam (recibido "${String(parsed.type)}")`
		);
	}
	if (!parsed.questions || parsed.questions.length === 0) {
		throw new Error(`${relPath}: el examen debe tener al menos una pregunta`);
	}

	const questions = parsed.questions.map((q, i) => ({
		id: String(i + 1),
		text: q.text ?? '',
		options: (q.options ?? []).map((o, j) => ({
			id: `${i + 1}-${j + 1}`,
			text: o.text ?? '',
			isCorrect: Boolean(o.correct),
		})),
	}));

	const content = JSON.stringify({
		questions,
		settings: { duration: parsed.settings?.duration ?? 15 },
	});

	return {
		sourcePath: relPath,
		title: parsed.title ?? slugTitle,
		type: 'exam',
		order,
		content,
		sourceHash,
	};
}

function parseMarkdownLesson(
	relPath: string,
	rawContent: string,
	order: number,
	slugTitle: string,
	sourceHash: string
): ParsedLesson {
	const { data: frontmatter, content: body } = matter(rawContent);
	const type = frontmatter.type as LessonType | undefined;
	if (!type || !LESSON_TYPES.includes(type) || type === 'exam') {
		throw new Error(
			`${relPath}: type "${String(frontmatter.type)}" no reconocido (esperado uno de: text, video, pdf, podcast)`
		);
	}
	const title = typeof frontmatter.title === 'string' ? frontmatter.title : slugTitle;

	let content: string;
	if (type === 'text') {
		content = JSON.stringify({ html: markdownToHtml(body), imageUrl: '' });
	} else {
		if (!frontmatter.url) {
			throw new Error(`${relPath}: las lecciones de tipo "${type}" requieren "url" en el frontmatter`);
		}
		content = JSON.stringify({
			url: String(frontmatter.url),
			html: body.trim() ? markdownToHtml(body) : '',
		});
	}

	return { sourcePath: relPath, title, type, order, content, sourceHash };
}
