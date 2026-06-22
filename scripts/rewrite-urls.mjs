// Reescribe las URLs Supabase -> Azure en la BD vía supabase-js (service role).
// Guarda los valores originales en scripts/url-rewrite-backup.json (red de seguridad
// para revertir, ya que el free tier no deja sacar snapshot).
//
//   node scripts/rewrite-urls.mjs            # dry-run: solo cuenta y muestra
//   node scripts/rewrite-urls.mjs --apply    # aplica los cambios
//
// Revertir:  node scripts/rewrite-urls.mjs --revert

import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OLD = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
const NEW = `${process.env.NEXT_PUBLIC_AZURE_BLOB_BASE}/`;
const BACKUP = new URL('./url-rewrite-backup.json', import.meta.url);

// tabla -> columnas de texto que pueden contener URLs de media
const TARGETS = {
    Lesson: ['content'],
    Bootcamp: ['imageUrl'],
    Certificate: ['backgroundImageUrl', 'instructorSignatureUrl', 'directorSignatureUrl'],
};

const swap = (v, from, to) => (typeof v === 'string' && v.includes(from) ? v.split(from).join(to) : v);

async function revert() {
    const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
    for (const { table, id, before } of backup) {
        const { error } = await supa.from(table).update(before).eq('id', id);
        if (error) throw new Error(`${table}#${id}: ${error.message}`);
    }
    console.log(`↩️  Revertidas ${backup.length} filas desde el backup.`);
}

async function run() {
    const backup = [];
    let touched = 0;

    for (const [table, cols] of Object.entries(TARGETS)) {
        const { data, error } = await supa.from(table).select(['id', ...cols].join(','));
        if (error) throw new Error(`${table}: ${error.message}`);

        for (const row of data) {
            const before = {}, after = {};
            for (const c of cols) {
                const next = swap(row[c], OLD, NEW);
                if (next !== row[c]) { before[c] = row[c]; after[c] = next; }
            }
            if (Object.keys(after).length === 0) continue;

            touched++;
            backup.push({ table, id: row.id, before });
            console.log(`${APPLY ? '✏️ ' : '· '} ${table}#${row.id}: ${Object.keys(after).join(', ')}`);

            if (APPLY) {
                const { error: upErr } = await supa.from(table).update(after).eq('id', row.id);
                if (upErr) throw new Error(`update ${table}#${row.id}: ${upErr.message}`);
            }
        }
    }

    if (APPLY) {
        fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
        console.log(`\n✅ ${touched} filas actualizadas. Backup en scripts/url-rewrite-backup.json`);
    } else {
        console.log(`\n🔎 Dry-run: ${touched} filas cambiarían. Corre con --apply para aplicar.`);
    }
}

await (REVERT ? revert() : run());
