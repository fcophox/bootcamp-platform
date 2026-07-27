import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';

const TEMPLATE_FILES = [
    'course.yaml',
    'README.md',
    'modules/01-introduccion/module.yaml',
    'modules/01-introduccion/01-bienvenida.md',
    'modules/01-introduccion/02-video-intro.md',
    'modules/01-introduccion/03-quiz.yaml',
];

export async function GET() {
    const zip = new JSZip();
    const baseDir = path.join(process.cwd(), 'examples', 'course-template');

    for (const relPath of TEMPLATE_FILES) {
        const content = await readFile(path.join(baseDir, relPath), 'utf8');
        zip.file(relPath, content);
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const uint8buffer = new Uint8Array(buffer);

    return new NextResponse(new Blob([uint8buffer], { type: 'application/zip' }), {
        headers: {
            'Content-Disposition': 'attachment; filename="curso-plantilla.zip"',
        },
    });
}
