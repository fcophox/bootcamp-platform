'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export type TipoPregunta =
    | 'likert_5'
    | 'caras'
    | 'nps'
    | 'like_dislike'
    | 'escala_7'
    | 'escala_3'
    | 'comentario'
    | 'alternativas';

export interface MedicionPregunta {
    id: string;
    bootcampId: number;
    createdBy: string;
    texto: string;
    tipo: TipoPregunta;
    opciones: string[] | null;
    orden: number;
    enviada: boolean;
    pausada: boolean;
    createdAt: string;
}

async function requireAdminOrDocente() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado.');
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .single();
    if (!roleData || !['superadmin', 'docente'].includes(roleData.role)) {
        throw new Error('No tienes permisos suficientes.');
    }
    return { supabase, user };
}

// ── Obtener preguntas de un bootcamp ──────────────────────────────────────────
export async function getMedicionPreguntas(bootcampId: number): Promise<MedicionPregunta[]> {
    const { supabase } = await requireAdminOrDocente();
    const { data, error } = await supabase
        .from('MedicionPregunta')
        .select('*')
        .eq('bootcampId', bootcampId)
        .order('orden', { ascending: true });
    if (error) {
        console.error('Error fetching preguntas:', error);
        return [];
    }
    return data || [];
}

// ── Crear pregunta ────────────────────────────────────────────────────────────
export async function createMedicionPregunta({
    bootcampId,
    texto,
    tipo,
    orden,
    opciones,
}: {
    bootcampId: number;
    texto: string;
    tipo: TipoPregunta;
    orden: number;
    opciones?: string[] | null;
}) {
    const { supabase, user } = await requireAdminOrDocente();
    const { data, error } = await supabase
        .from('MedicionPregunta')
        .insert({ bootcampId, createdBy: user.id, texto, tipo, orden, enviada: false, opciones: opciones ?? null })
        .select()
        .single();
    if (error) throw new Error('No se pudo crear la pregunta: ' + error.message);
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    return data as MedicionPregunta;
}

// ── Actualizar pregunta ───────────────────────────────────────────────────────
export async function updateMedicionPregunta({
    id,
    texto,
    tipo,
    opciones,
}: {
    id: string;
    texto: string;
    tipo: TipoPregunta;
    opciones?: string[] | null;
}) {
    const { supabase } = await requireAdminOrDocente();
    const { error } = await supabase
        .from('MedicionPregunta')
        .update({ texto, tipo, opciones: opciones ?? null })
        .eq('id', id);
    if (error) throw new Error('No se pudo actualizar la pregunta: ' + error.message);
}

// ── Eliminar pregunta (cualquier estado) ──────────────────────────────────────
export async function deleteMedicionPregunta(id: string, bootcampId: number) {
    const { supabase } = await requireAdminOrDocente();
    const { error } = await supabase
        .from('MedicionPregunta')
        .delete()
        .eq('id', id);
    if (error) throw new Error('No se pudo eliminar la pregunta: ' + error.message);
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

// ── Pausar / reactivar pregunta ───────────────────────────────────────────────
export async function togglePausarPregunta(id: string, pausada: boolean) {
    const { supabase } = await requireAdminOrDocente();
    const { error } = await supabase
        .from('MedicionPregunta')
        .update({ pausada })
        .eq('id', id);
    if (error) throw new Error('No se pudo actualizar la pregunta: ' + error.message);
}

// ── Reordenar preguntas ───────────────────────────────────────────────────────
export async function reorderMedicionPreguntas(items: { id: string; orden: number }[]) {
    const { supabase } = await requireAdminOrDocente();
    const updates = items.map(({ id, orden }) =>
        supabase.from('MedicionPregunta').update({ orden }).eq('id', id)
    );
    await Promise.all(updates);
}

// ── Enviar preguntas a alumnos ────────────────────────────────────────────────
export async function enviarMedicion(bootcampId: number) {
    const { supabase } = await requireAdminOrDocente();
    const { error } = await supabase
        .from('MedicionPregunta')
        .update({ enviada: true })
        .eq('bootcampId', bootcampId)
        .eq('enviada', false);
    if (error) throw new Error('No se pudo enviar la medición: ' + error.message);
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    return { success: true };
}

// ── Resultados de una encuesta agrupados por alumno ───────────────────────────
export interface RespuestaAlumno {
    userId: string;
    email: string;
    respuestas: { preguntaId: string; preguntaTexto: string; tipo: TipoPregunta; valor: string }[];
}

export async function getResultadosEncuesta(bootcampId: number): Promise<{
    totalRespuestas: number;
    alumnos: RespuestaAlumno[];
}> {
    const { supabase } = await requireAdminOrDocente();

    // Preguntas del bootcamp (todas, sin filtro de pausada para el admin)
    const { data: preguntas, error: pErr } = await supabase
        .from('MedicionPregunta')
        .select('id, texto, tipo')
        .eq('bootcampId', bootcampId)
        .eq('enviada', true)
        .order('orden', { ascending: true });

    if (pErr || !preguntas || preguntas.length === 0) return { totalRespuestas: 0, alumnos: [] };

    const preguntaIds = preguntas.map((p: any) => p.id);

    // Respuestas de todos los alumnos
    const { data: respuestas, error: rErr } = await supabase
        .from('MedicionRespuesta')
        .select('preguntaId, userId, valor')
        .in('preguntaId', preguntaIds);

    if (rErr || !respuestas || respuestas.length === 0) return { totalRespuestas: 0, alumnos: [] };

    // Emails de los alumnos vía UserRole
    const userIds = [...new Set(respuestas.map((r: any) => r.userId))];
    const { data: roles } = await supabase
        .from('UserRole')
        .select('id, email')
        .in('id', userIds);

    const emailMap: Record<string, string> = {};
    (roles || []).forEach((r: any) => { emailMap[r.id] = r.email; });

    // Mapas de lookup
    const preguntaMap: Record<string, { texto: string; tipo: TipoPregunta }> = {};
    preguntas.forEach((p: any) => { preguntaMap[p.id] = { texto: p.texto, tipo: p.tipo }; });

    // Agrupar respuestas por alumno
    const byUser: Record<string, RespuestaAlumno> = {};
    for (const r of respuestas as any[]) {
        if (!byUser[r.userId]) {
            byUser[r.userId] = {
                userId: r.userId,
                email: emailMap[r.userId] || 'Usuario desconocido',
                respuestas: [],
            };
        }
        const pInfo = preguntaMap[r.preguntaId];
        if (pInfo) {
            byUser[r.userId].respuestas.push({
                preguntaId: r.preguntaId,
                preguntaTexto: pInfo.texto,
                tipo: pInfo.tipo,
                valor: r.valor,
            });
        }
    }

    // Ordenar respuestas de cada alumno por el orden de la pregunta
    const ordenMap: Record<string, number> = {};
    preguntas.forEach((p: any, i: number) => { ordenMap[p.id] = i; });
    Object.values(byUser).forEach(a => {
        a.respuestas.sort((x, y) => (ordenMap[x.preguntaId] ?? 0) - (ordenMap[y.preguntaId] ?? 0));
    });

    return {
        totalRespuestas: userIds.length,
        alumnos: Object.values(byUser),
    };
}

// ════════════════════════════════════════════════════════════════════════════════
// ACCIONES PARA ALUMNOS
// ════════════════════════════════════════════════════════════════════════════════

export interface EncuestaBootcamp {
    id: number;
    title: string;
    icon?: string;
    color?: string;
    preguntas: MedicionPregunta[];
    respuestas: Record<string, string>; // preguntaId → valor ya respondido
    totalPreguntas: number;
    respondidas: number;
}

// ── Obtener todas las encuestas enviadas para los bootcamps del alumno ────────
export async function getEncuestasAlumno(): Promise<EncuestaBootcamp[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado.');

    // 1. Bootcamps activos del alumno (por email)
    const { data: studentRecords } = await supabase
        .from('BootcampStudent')
        .select('bootcampId, Bootcamp:bootcampId(id, title, icon, color)')
        .eq('userId', user.id)
        .in('status', ['active', 'frozen', 'completed']);

    if (!studentRecords || studentRecords.length === 0) return [];

    const bootcampIds = studentRecords.map((r: any) => r.bootcampId);

    // 2. Preguntas enviadas y no pausadas de esos bootcamps
    const { data: preguntas } = await supabase
        .from('MedicionPregunta')
        .select('*')
        .in('bootcampId', bootcampIds)
        .eq('enviada', true)
        .eq('pausada', false)
        .order('orden', { ascending: true });

    if (!preguntas || preguntas.length === 0) return [];

    // 3. Respuestas existentes del alumno
    const preguntaIds = preguntas.map((p: any) => p.id);
    const { data: respuestasData } = await supabase
        .from('MedicionRespuesta')
        .select('preguntaId, valor')
        .eq('userId', user.id)
        .in('preguntaId', preguntaIds);

    const respuestasMap: Record<string, string> = {};
    (respuestasData || []).forEach((r: any) => {
        respuestasMap[r.preguntaId] = r.valor;
    });

    // 4. Agrupar por bootcamp
    const byBootcamp: Record<number, EncuestaBootcamp> = {};
    for (const sr of studentRecords) {
        const bc = (sr as any).Bootcamp;
        if (!bc) continue;
        const bId = bc.id as number;
        const bPreguntas = (preguntas as MedicionPregunta[]).filter(p => p.bootcampId === bId);
        if (bPreguntas.length === 0) continue;
        byBootcamp[bId] = {
            id: bId,
            title: bc.title,
            icon: bc.icon,
            color: bc.color,
            preguntas: bPreguntas,
            respuestas: respuestasMap,
            totalPreguntas: bPreguntas.length,
            respondidas: bPreguntas.filter(p => respuestasMap[p.id] !== undefined).length,
        };
    }

    return Object.values(byBootcamp);
}

// ── Guardar respuesta de un alumno ────────────────────────────────────────────
export async function responderPregunta(preguntaId: string, valor: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado.');

    const { error } = await supabase
        .from('MedicionRespuesta')
        .upsert({ preguntaId, userId: user.id, valor }, { onConflict: 'preguntaId,userId' });

    if (error) throw new Error('No se pudo guardar la respuesta: ' + error.message);
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}

// ── Enviar todas las respuestas de una encuesta (batch) ────────────────────────
export async function enviarRespuestasEncuesta(
    respuestas: { preguntaId: string; valor: string }[]
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado.');

    const rows = respuestas.map(r => ({ preguntaId: r.preguntaId, userId: user.id, valor: r.valor }));
    const { error } = await supabase
        .from('MedicionRespuesta')
        .upsert(rows, { onConflict: 'preguntaId,userId' });

    if (error) throw new Error('No se pudo enviar las respuestas: ' + error.message);
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}
