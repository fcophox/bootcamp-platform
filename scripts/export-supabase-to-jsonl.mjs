import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const outputDir = path.join(process.cwd(), 'convex_export');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function writeJsonl(filename, items) {
  const filePath = path.join(outputDir, `${filename}.jsonl`);
  const content = items.map((item) => JSON.stringify(item)).join('\n');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Exportado ${items.length} registros a ${filePath}`);
}

async function run() {
  console.log('🔄 Exportando datos desde Supabase...');

  // 1. Export Auth Users for legacyAuth
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error obteniendo usuarios de auth:', authError);
  } else {
    // Also fetch UserRole table to know roles
    const { data: userRoles } = await supabase.from('UserRole').select('*');
    const roleMap = new Map();
    (userRoles || []).forEach((ur) => roleMap.set(ur.id, ur.role));

    const legacyAuthItems = authData.users.map((u) => {
      const role = roleMap.get(u.id) || u.user_metadata?.role || 'alumno';
      return {
        supabaseUserId: u.id,
        email: (u.email || '').toLowerCase().trim(),
        passwordHash: u.encrypted_password || '',
        role,
        migrated: false,
      };
    });
    writeJsonl('legacyAuth', legacyAuthItems);
  }

  // 2. Export Database Tables
  const tables = [
    { sName: 'Bootcamp', cName: 'bootcamps' },
    { sName: 'Module', cName: 'modules' },
    { sName: 'Lesson', cName: 'lessons' },
    { sName: 'Exam', cName: 'exams' },
    { sName: 'ExamQuestion', cName: 'examQuestions' },
    { sName: 'ExamOption', cName: 'examOptions' },
    { sName: 'ExamSubmission', cName: 'examSubmissions' },
    { sName: 'BootcampStudent', cName: 'bootcampStudents' },
    { sName: 'Invitation', cName: 'invitations' },
    { sName: 'LessonCompletion', cName: 'lessonCompletions' },
    { sName: 'LessonFeedback', cName: 'lessonFeedbacks' },
    { sName: 'Certificate', cName: 'certificates' },
    { sName: 'Masterclass', cName: 'masterclasses' },
    { sName: 'MedicionEmpresa', cName: 'medicionEmpresas' },
    { sName: 'MedicionEvaluacion', cName: 'medicionEvaluaciones' },
    { sName: 'MedicionResultado', cName: 'medicionResultados' },
  ];

  for (const { sName, cName } of tables) {
    const { data, error } = await supabase.from(sName).select('*');
    if (error) {
      console.warn(`⚠️ Error exportando tabla ${sName}:`, error.message);
      writeJsonl(cName, []);
    } else {
      writeJsonl(cName, data || []);
    }
  }

  console.log('🎉 Exportación finalizada en carpeta convex_export/');
}

run();
