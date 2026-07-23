import { ConvexHttpClient } from 'convex/browser';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { api } from '../convex/_generated/api.js';

dotenv.config({ path: '.env.local' });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error('Error: NEXT_PUBLIC_CONVEX_URL no está configurada en .env.local');
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
const exportDir = path.join(process.cwd(), 'convex_export');

function readJsonl(filename) {
  const filePath = path.join(exportDir, `${filename}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function run() {
  console.log('🌱 Ejecutando migración de datos a Convex en', CONVEX_URL);

  // 1. Import Legacy Auth
  const legacyUsers = readJsonl('legacyAuth');
  if (legacyUsers.length > 0) {
    const resAuth = await client.mutation(api.seed.importLegacyAuth, { users: legacyUsers });
    console.log('✅ Usuarios legacy importados:', resAuth);
  }

  // 2. Read all tables
  const bootcamps = readJsonl('bootcamps');
  const modules = readJsonl('modules');
  const lessons = readJsonl('lessons');
  const bootcampStudents = readJsonl('bootcampStudents');
  const invitations = readJsonl('invitations');
  const lessonCompletions = readJsonl('lessonCompletions');
  const certificates = readJsonl('certificates');
  const masterclasses = readJsonl('masterclasses');

  // Chunk lessons and completions to stay below Convex 8MB mutation payload limit
  const lessonChunks = chunkArray(lessons, 100);
  const completionChunks = chunkArray(lessonCompletions, 200);

  console.log(`📦 Enviando ${bootcamps.length} bootcamps, ${modules.length} módulos, ${lessons.length} lecciones, ${lessonCompletions.length} progreso...`);

  const resData = await client.mutation(api.seed.importAllData, {
    bootcamps,
    modules,
    lessons: lessonChunks,
    bootcampStudents,
    invitations,
    lessonCompletions: completionChunks,
    certificates,
    masterclasses,
  });

  console.log('🎉 Migración de datos a Convex completada exitosamente:', resData);
}

run().catch((err) => {
  console.error('❌ Error ejecutando seed:', err);
  process.exit(1);
});
