import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { readTemplateFiles } from '@/lib/courseImport/template';

export async function GET() {
    const zip = new JSZip();

    // Same list the import uses when committing the template into an empty
    // repo (lib/courseImport/template.ts), so the download and the push agree.
    for (const file of await readTemplateFiles()) {
        zip.file(file.path, file.content);
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const uint8buffer = new Uint8Array(buffer);

    return new NextResponse(new Blob([uint8buffer], { type: 'application/zip' }), {
        headers: {
            'Content-Disposition': 'attachment; filename="curso-plantilla.zip"',
        },
    });
}
