// Migra el bucket "media" de Supabase Storage a Azure Blob, conservando la
// MISMA ruta de cada archivo. Así reescribir las URLs en la BD es un simple
// reemplazo de prefijo (ver scripts/rewrite-urls.sql que este script genera).
//
// Copia server-side (Azure jala el archivo desde la URL pública de Supabase):
// no descarga nada a tu máquina, así que da igual cuántos GB de video tengas.
//
// Uso:
//   node scripts/migrate-media-to-azure.mjs --dry-run   # solo lista y cuenta, no copia
//   node scripts/migrate-media-to-azure.mjs             # copia a Azure + genera el SQL
//
// Requiere en .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER, NEXT_PUBLIC_AZURE_BLOB_BASE

import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { BlobServiceClient } from '@azure/storage-blob';

const DRY = process.argv.includes('--dry-run');
const BUCKET = 'media';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AZURE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'media';
const AZURE_BASE = process.env.NEXT_PUBLIC_AZURE_BLOB_BASE; // p.ej. https://cuenta.blob.core.windows.net/media

const SUPA_BASE = `${SUPA_URL}/storage/v1/object/public/${BUCKET}`;

if (!SUPA_URL || !SUPA_KEY) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
if (!DRY && (!AZURE_CONN || !AZURE_BASE)) throw new Error('Faltan AZURE_STORAGE_CONNECTION_STRING / NEXT_PUBLIC_AZURE_BLOB_BASE en .env');

const supa = createClient(SUPA_URL, SUPA_KEY);
const container = DRY ? null : BlobServiceClient.fromConnectionString(AZURE_CONN).getContainerClient(CONTAINER);

// Lista recursiva de todas las rutas de archivo dentro del bucket.
async function listAll(prefix = '') {
    const out = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supa.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
        if (error) throw error;
        if (!data.length) break;
        for (const item of data) {
            const path = prefix ? `${prefix}/${item.name}` : item.name;
            // Las carpetas vienen con id/metadata en null; los archivos traen id.
            if (item.id === null && item.metadata === null) {
                out.push(...await listAll(path));
            } else {
                out.push(path);
            }
        }
        if (data.length < 1000) break;
    }
    return out;
}

// Copia un lote en paralelo (Azure jala desde la URL pública de Supabase).
async function copyBatch(paths) {
    await Promise.all(paths.map(async (path) => {
        const src = `${SUPA_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
        const poller = await container.getBlockBlobClient(path).beginCopyFromURL(src);
        await poller.pollUntilDone();
    }));
}

function writeRewriteSql() {
    const r = (col) => `replace(${col}, '${SUPA_BASE}/', '${AZURE_BASE}/')`;
    const like = (col) => `${col} like '%${SUPA_BASE}/%'`;
    const sql = `-- Generado por migrate-media-to-azure.mjs. Ejecútalo en el SQL Editor de Supabase
-- DESPUÉS de confirmar que la copia a Azure terminó OK. Haz un backup/snapshot antes.

update "Lesson"      set content = ${r('content')} where ${like('content')};
update "Bootcamp"    set "imageUrl" = ${r('"imageUrl"')} where ${like('"imageUrl"')};
update "Certificate" set
  "backgroundImageUrl"    = ${r('"backgroundImageUrl"')},
  "instructorSignatureUrl"= ${r('"instructorSignatureUrl"')},
  "directorSignatureUrl"  = ${r('"directorSignatureUrl"')}
where ${like('"backgroundImageUrl"')}
   or ${like('"instructorSignatureUrl"')}
   or ${like('"directorSignatureUrl"')};
`;
    fs.writeFileSync(new URL('./rewrite-urls.sql', import.meta.url), sql);
    console.log('📝 SQL de reescritura escrito en scripts/rewrite-urls.sql');
}

// --- run ---
console.log(`🔎 Listando ${BUCKET}…`);
const paths = await listAll();
console.log(`📦 ${paths.length} archivos encontrados.`);

// self-check: las rutas no deben venir con prefijo del bucket ni empezar con "/"
for (const p of paths) {
    if (p.startsWith('/') || p.startsWith(`${BUCKET}/`)) throw new Error(`Ruta inesperada: ${p}`);
}

fs.writeFileSync(new URL('./media-manifest.json', import.meta.url), JSON.stringify(paths, null, 2));
console.log('📝 Manifiesto escrito en scripts/media-manifest.json');

if (DRY) {
    console.log('✅ Dry-run: no se copió nada. Revisa el manifiesto y vuelve a correr sin --dry-run.');
    process.exit(0);
}

const BATCH = 10;
for (let i = 0; i < paths.length; i += BATCH) {
    await copyBatch(paths.slice(i, i + BATCH));
    console.log(`⬆️  ${Math.min(i + BATCH, paths.length)}/${paths.length} copiados`);
}

writeRewriteSql();
console.log('✅ Copia completa. Ahora ejecuta scripts/rewrite-urls.sql en Supabase.');
