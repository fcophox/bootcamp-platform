'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

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
    _id?: string;
    bootcampId: number | string;
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
    const token = await convexAuthNextjsToken();
    if (!token) throw new Error('No autenticado.');
    
    // Get current user with role from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );
    
    if (!currentUser) throw new Error('No autenticado.');
    
    const { email, role } = currentUser;
    if (!['superadmin', 'docente'].includes(role)) {
        throw new Error('No tienes permisos suficientes.');
    }
    
    const supabase = await createClient();
    return { supabase, email, role };
}

// ── Obtener preguntas de un bootcamp ──────────────────────────────────────────
export async function getMedicionPreguntas(bootcampId: number | string): Promise<MedicionPregunta[]> {
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
    bootcampId: number | string;
    texto: string;
    tipo: TipoPregunta;
    orden: number;
    opciones?: string[] | null;
}) {
    const { supabase, email } = await requireAdminOrDocente();
    const { data, error } = await supabase
        .from('MedicionPregunta')
        .insert({ bootcampId, createdBy: email, texto, tipo, orden, enviada: false, opciones: opciones ?? null })
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
export async function deleteMedicionPregunta(id: string, bootcampId: number | string) {
    const { supabase } = await requireAdminOrDocente();
    const { error } = await supabase
        .from('MedicionPregunta')
        .delete()
        .eq('id', id);
    if (error) throw new Error('No se pudo eliminar la pregunta: ' + error.message);
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

// ── Eliminar encuesta completa (preguntas + respuestas en cascade) ────────────
export async function eliminarEncuesta(bootcampId: number | string) {
    const { supabase } = await requireAdminOrDocente();
    // MedicionRespuesta se elimina en cascade por FK ON DELETE CASCADE
    const { error } = await supabase
        .from('MedicionPregunta')
        .delete()
        .eq('bootcampId', bootcampId);
    if (error) throw new Error('No se pudo eliminar la encuesta: ' + error.message);
    revalidatePath('/cms/encuestas');
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}

// ── Limpiar todas las preguntas de un bootcamp ───────────────────────────────
export async function limpiarMedicionPreguntas(bootcampId: number | string) {
    const { supabase } = await requireAdminOrDocente();
    const { error } = await supabase
        .from('MedicionPregunta')
        .delete()
        .eq('bootcampId', bootcampId);
    if (error) throw new Error('No se pudo limpiar las preguntas: ' + error.message);
    revalidatePath('/cms/encuestas');
    revalidatePath('/dashboard/encuestas');
    return { success: true };
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

// ── Alumnos activos de un bootcamp para el modal de envío ─────────────────────
export interface AlumnoBootcamp {
    userId: string | null;
    email: string;
    nombre: string;
}

export async function getAlumnosBootcamp(bootcampId: number | string): Promise<AlumnoBootcamp[]> {
    const { supabase } = await requireAdminOrDocente();

    const { data, error } = await supabase
        .from('BootcampStudent')
        .select('userId, email')
        .eq('bootcampId', bootcampId)
        .in('status', ['active', 'frozen', 'completed']);

    if (error || !data) return [];

    // Obtener nombres desde UserRole si existen
    const emails = data.map((s: any) => s.email).filter(Boolean);
    const { data: roles } = await supabase
        .from('UserRole')
        .select('email, full_name')
        .in('email', emails);

    const nameMap: Record<string, string> = {};
    (roles || []).forEach((r: any) => { if (r.full_name) nameMap[r.email] = r.full_name; });

    return data.map((s: any) => ({
        userId: s.userId ?? null,
        email: s.email,
        nombre: nameMap[s.email] || s.email,
    }));
}

// ── Enviar preguntas a alumnos ────────────────────────────────────────────────
export async function enviarMedicion(bootcampId: number | string) {
    const { supabase } = await requireAdminOrDocente();
    const { error } = await supabase
        .from('MedicionPregunta')
        .update({ enviada: true, pausada: false })
        .eq('bootcampId', bootcampId)
        .eq('enviada', false);
    if (error) throw new Error('No se pudo enviar la medición: ' + error.message);
    revalidatePath('/cms/encuestas');
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}

// ── Activar encuesta para alumnos seleccionados ────────────────────────────────
export async function enviarEncuestaPorEmail(
    bootcampId: number | string,
    bootcampTitle: string,
    emails: string[]
) {
    const { supabase } = await requireAdminOrDocente();
    
    console.log('[enviarEncuestaPorEmail] Activando encuesta:', { bootcampId, bootcampTitle, emails });
    
    // Primero obtener las preguntas de este bootcamp
    const { data: preguntas, error: fetchError } = await supabase
        .from('MedicionPregunta')
        .select('id, _id, enviada')
        .eq('bootcampId', bootcampId);
    
    console.log('[enviarEncuestaPorEmail] Preguntas encontradas:', { preguntas, fetchError });
    
    if (fetchError) {
        throw new Error('Error al buscar preguntas: ' + fetchError.message);
    }
    
    if (!preguntas || preguntas.length === 0) {
        throw new Error('No se encontraron preguntas para este bootcamp');
    }
    
    // Obtener los IDs de las preguntas (usar _id que es el ID de Convex)
    const preguntaIds = preguntas.map((p: any) => p._id || p.id).filter(Boolean);
    
    console.log('[enviarEncuestaPorEmail] IDs a actualizar:', preguntaIds);
    
    // Actualizar cada pregunta individualmente usando su ID
    for (const preguntaId of preguntaIds) {
        const { error: updateError } = await supabase
            .from('MedicionPregunta')
            .update({ enviada: true, pausada: false })
            .eq('id', preguntaId);
        
        if (updateError) {
            console.error('[enviarEncuestaPorEmail] Error actualizando pregunta:', preguntaId, updateError);
        }
    }
    
    console.log('[enviarEncuestaPorEmail] Actualizacion completada');
    
    revalidatePath('/cms/encuestas');
    revalidatePath('/dashboard/encuestas');
    
    return { 
        success: true, 
        emailsSent: emails.length,
        emailsFailed: 0,
        results: emails.map(email => ({ email, success: true }))
    };
}

export async function retirarMedicion(bootcampId: number | string) {
    const { supabase } = await requireAdminOrDocente();
    
    // Primero obtener las preguntas de este bootcamp
    const { data: preguntas } = await supabase
        .from('MedicionPregunta')
        .select('id, _id')
        .eq('bootcampId', bootcampId);
    
    if (!preguntas || preguntas.length === 0) {
        throw new Error('No se encontraron preguntas para retirar');
    }
    
    // Actualizar cada pregunta usando su ID
    for (const pregunta of preguntas) {
        const preguntaId = (pregunta as any)._id || pregunta.id;
        await supabase
            .from('MedicionPregunta')
            .update({ enviada: false })
            .eq('id', preguntaId);
    }
    
    revalidatePath('/cms/encuestas');
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}

export async function pausarEncuesta(bootcampId: number | string) {
    const { supabase } = await requireAdminOrDocente();
    
    // Primero obtener las preguntas de este bootcamp
    const { data: preguntas } = await supabase
        .from('MedicionPregunta')
        .select('id, _id')
        .eq('bootcampId', bootcampId);
    
    if (!preguntas || preguntas.length === 0) {
        throw new Error('No se encontraron preguntas para pausar');
    }
    
    // Actualizar cada pregunta usando su ID
    for (const pregunta of preguntas) {
        const preguntaId = (pregunta as any)._id || pregunta.id;
        await supabase
            .from('MedicionPregunta')
            .update({ pausada: true })
            .eq('id', preguntaId);
    }
    
    revalidatePath('/cms/encuestas');
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}

export async function reactivarEncuesta(bootcampId: number | string) {
    const { supabase } = await requireAdminOrDocente();
    
    // Primero obtener las preguntas de este bootcamp
    const { data: preguntas } = await supabase
        .from('MedicionPregunta')
        .select('id, _id')
        .eq('bootcampId', bootcampId);
    
    if (!preguntas || preguntas.length === 0) {
        throw new Error('No se encontraron preguntas para reactivar');
    }
    
    // Actualizar cada pregunta usando su ID
    for (const pregunta of preguntas) {
        const preguntaId = (pregunta as any)._id || pregunta.id;
        await supabase
            .from('MedicionPregunta')
            .update({ pausada: false })
            .eq('id', preguntaId);
    }
    
    revalidatePath('/cms/encuestas');
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}

// ── Resultados de una encuesta agrupados por alumno ───────────────────────────
export interface RespuestaAlumno {
    userId: string;
    email: string;
    respuestas: { preguntaId: string; preguntaTexto: string; tipo: TipoPregunta; valor: string }[];
}

export async function getResultadosEncuesta(bootcampId: number | string): Promise<{
    totalRespuestas: number;
    alumnos: RespuestaAlumno[];
}> {
    const { supabase } = await requireAdminOrDocente();

    // Preguntas del bootcamp - obtener todas y filtrar en memoria
    const { data: allPreguntas, error: pErr } = await supabase
        .from('MedicionPregunta')
        .select('id, _id, texto, tipo, orden, enviada')
        .eq('bootcampId', bootcampId);

    if (pErr || !allPreguntas || allPreguntas.length === 0) return { totalRespuestas: 0, alumnos: [] };

    // Filtrar solo las enviadas
    const preguntas = allPreguntas.filter((p: any) => p.enviada === true);
    if (preguntas.length === 0) return { totalRespuestas: 0, alumnos: [] };
    
    // Ordenar por orden
    preguntas.sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0));

    console.log('[getResultadosEncuesta] Preguntas encontradas:', preguntas.map((p: any) => ({ id: p.id, _id: p._id, texto: p.texto })));

    // Usar tanto id como _id para buscar respuestas
    const preguntaIds = preguntas.flatMap((p: any) => [p._id, p.id].filter(Boolean));

    // Respuestas de todos los alumnos
    const { data: respuestas, error: rErr } = await supabase
        .from('MedicionRespuesta')
        .select('preguntaId, userId, valor')
        .in('preguntaId', preguntaIds);

    console.log('[getResultadosEncuesta] Respuestas encontradas:', respuestas);

    if (rErr || !respuestas || respuestas.length === 0) return { totalRespuestas: 0, alumnos: [] };

    // userId could be: UUID (old Supabase auth), email (new Convex auth), or Convex user ID
    const userIds: string[] = Array.from(new Set(respuestas.map((r: any) => String(r.userId))));
    
    // Build email map - try multiple sources
    const emailMap: Record<string, string> = {};
    
    // Check if any userId looks like an email (contains @)
    const potentialEmails = userIds.filter(id => id.includes('@'));
    const potentialUuids = userIds.filter(id => !id.includes('@'));
    
    // For email-like userIds, use them directly
    for (const email of potentialEmails) {
        emailMap[email] = email;
    }
    
    // For UUID-like userIds, try multiple sources
    if (potentialUuids.length > 0) {
        // 1. Try legacyAuth table (has supabaseUserId field)
        const { data: legacyUsers } = await supabase
            .from('legacyAuth')
            .select('supabaseUserId, email')
            .in('supabaseUserId', potentialUuids);
        
        if (legacyUsers) {
            for (const u of legacyUsers as any[]) {
                if (u.email && u.supabaseUserId) emailMap[u.supabaseUserId] = u.email;
            }
        }
        
        // 2. Try UserRole table for any remaining (id might be supabase user id)
        const remainingIds = potentialUuids.filter(id => !emailMap[id]);
        if (remainingIds.length > 0) {
            const { data: roles } = await supabase
                .from('UserRole')
                .select('id, email')
                .in('id', remainingIds);
            
            if (roles) {
                for (const r of roles as any[]) {
                    if (r.email) emailMap[r.id] = r.email;
                }
            }
        }
        
        // 3. Try Convex users table for any still remaining
        const stillRemainingIds = potentialUuids.filter(id => !emailMap[id]);
        if (stillRemainingIds.length > 0) {
            const { data: convexUsers } = await supabase
                .from('users')
                .select('_id, email')
                .in('_id', stillRemainingIds);
            
            if (convexUsers) {
                for (const u of convexUsers as any[]) {
                    if (u.email) emailMap[u._id] = u.email;
                }
            }
        }
    }

    // Mapas de lookup - usar tanto id como _id
    const preguntaMap: Record<string, { texto: string; tipo: TipoPregunta }> = {};
    preguntas.forEach((p: any) => { 
        const info = { texto: p.texto, tipo: p.tipo };
        if (p.id) preguntaMap[p.id] = info;
        if (p._id) preguntaMap[p._id] = info;
    });

    console.log('[getResultadosEncuesta] PreguntaMap keys:', Object.keys(preguntaMap));

    // Agrupar respuestas por alumno
    const byUser: Record<string, RespuestaAlumno> = {};
    for (const r of respuestas as any[]) {
        if (!byUser[r.userId]) {
            byUser[r.userId] = {
                userId: r.userId,
                email: emailMap[r.userId] || r.userId, // Fallback to userId if no email found
                respuestas: [],
            };
        }
        const pInfo = preguntaMap[r.preguntaId];
        console.log('[getResultadosEncuesta] Buscando pregunta:', r.preguntaId, 'encontrada:', !!pInfo);
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
    preguntas.forEach((p: any, i: number) => { 
        if (p.id) ordenMap[p.id] = i;
        if (p._id) ordenMap[p._id] = i;
    });
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
    const token = await convexAuthNextjsToken();
    if (!token) throw new Error('No autenticado.');
    
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );
    if (!currentUser) throw new Error('No autenticado.');
    
    const { email } = currentUser;
    const supabase = await createClient();

    console.log('[getEncuestasAlumno] Buscando encuestas para:', email);

    // 1. Bootcamps activos del alumno (por email)
    const { data: studentRecords } = await supabase
        .from('BootcampStudent')
        .select('bootcampId')
        .eq('email', email)
        .in('status', ['active', 'frozen', 'completed']);

    console.log('[getEncuestasAlumno] Student records:', studentRecords);

    if (!studentRecords || studentRecords.length === 0) return [];

    const bootcampIds = studentRecords.map((r: any) => r.bootcampId);
    console.log('[getEncuestasAlumno] Bootcamp IDs:', bootcampIds);

    // 2. Obtener información de los bootcamps
    const { data: bootcampsData } = await supabase
        .from('Bootcamp')
        .select('id, _id, title, icon, color')
        .in('id', bootcampIds);
    
    console.log('[getEncuestasAlumno] Bootcamps data:', bootcampsData);

    // 3. Preguntas de esos bootcamps - filtrar enviada y pausada en memoria
    const allPreguntas: any[] = [];
    for (const bootcampId of bootcampIds) {
        const { data: preguntasBootcamp } = await supabase
            .from('MedicionPregunta')
            .select('*')
            .eq('bootcampId', bootcampId);
        
        if (preguntasBootcamp) {
            allPreguntas.push(...preguntasBootcamp);
        }
    }
    
    console.log('[getEncuestasAlumno] Todas las preguntas:', allPreguntas.map(p => ({ id: p.id, _id: p._id, enviada: p.enviada, pausada: p.pausada })));
    
    // Filtrar: solo enviadas y no pausadas
    const preguntas = allPreguntas.filter((p: any) => p.enviada === true && p.pausada !== true);
    
    console.log('[getEncuestasAlumno] Preguntas filtradas (enviada=true, pausada!=true):', preguntas.length);

    if (preguntas.length === 0) return [];

    // 4. Respuestas existentes del alumno
    // Usar tanto id como _id para buscar respuestas
    const preguntaIds = preguntas.flatMap((p: any) => [p._id, p.id].filter(Boolean));
    console.log('[getEncuestasAlumno] Buscando respuestas con preguntaIds:', preguntaIds);
    
    const { data: respuestasData } = await supabase
        .from('MedicionRespuesta')
        .select('preguntaId, valor')
        .eq('userId', email)
        .in('preguntaId', preguntaIds);

    console.log('[getEncuestasAlumno] Respuestas encontradas:', respuestasData);

    // Crear mapa de respuestas - normalizar para que funcione con ambos formatos de ID
    const respuestasMap: Record<string, string> = {};
    (respuestasData || []).forEach((r: any) => {
        respuestasMap[r.preguntaId] = r.valor;
    });
    
    // Agregar aliases: si una respuesta tiene preguntaId que coincide con _id de una pregunta,
    // también agregarla con el id de esa pregunta (y viceversa)
    for (const pregunta of preguntas) {
        const pId = (pregunta as any).id;
        const p_Id = (pregunta as any)._id;
        
        // Si hay respuesta con _id, copiarla también a id
        if (p_Id && respuestasMap[p_Id] && pId && !respuestasMap[pId]) {
            respuestasMap[pId] = respuestasMap[p_Id];
        }
        // Si hay respuesta con id, copiarla también a _id
        if (pId && respuestasMap[pId] && p_Id && !respuestasMap[p_Id]) {
            respuestasMap[p_Id] = respuestasMap[pId];
        }
    }

    console.log('[getEncuestasAlumno] RespuestasMap normalizado:', respuestasMap);

    // 5. Crear mapa de bootcamps
    const bootcampMap: Record<string, any> = {};
    (bootcampsData || []).forEach((bc: any) => {
        const bcId = bc._id || bc.id;
        bootcampMap[String(bcId)] = bc;
    });

    // 6. Agrupar por bootcamp
    const byBootcamp: Record<string, EncuestaBootcamp> = {};
    for (const pregunta of preguntas) {
        const bIdStr = String(pregunta.bootcampId);
        const bc = bootcampMap[bIdStr];
        
        if (!byBootcamp[bIdStr]) {
            byBootcamp[bIdStr] = {
                id: pregunta.bootcampId,
                title: bc?.title || 'Bootcamp',
                icon: bc?.icon,
                color: bc?.color,
                preguntas: [],
                respuestas: respuestasMap,
                totalPreguntas: 0,
                respondidas: 0,
            };
        }
        
        byBootcamp[bIdStr].preguntas.push(pregunta as MedicionPregunta);
    }

    // Calcular totales - usar _id o id para buscar en respuestasMap
    for (const bIdStr of Object.keys(byBootcamp)) {
        const enc = byBootcamp[bIdStr];
        enc.totalPreguntas = enc.preguntas.length;
        enc.respondidas = enc.preguntas.filter(p => {
            const pId = (p as any)._id || p.id;
            return respuestasMap[pId] !== undefined;
        }).length;
        // Ordenar por orden
        enc.preguntas.sort((a, b) => a.orden - b.orden);
    }

    console.log('[getEncuestasAlumno] Resultado final:', Object.keys(byBootcamp).length, 'encuestas');

    return Object.values(byBootcamp);
}

// ── Guardar respuesta de un alumno ────────────────────────────────────────────
export async function responderPregunta(preguntaId: string, valor: string) {
    const token = await convexAuthNextjsToken();
    if (!token) throw new Error('No autenticado.');
    
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );
    if (!currentUser) throw new Error('No autenticado.');
    
    const { email } = currentUser;
    const supabase = await createClient();

    const { error } = await supabase
        .from('MedicionRespuesta')
        .upsert({ preguntaId, userId: email, valor }, { onConflict: 'preguntaId,userId' });

    if (error) throw new Error('No se pudo guardar la respuesta: ' + error.message);
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}

// ── Enviar todas las respuestas de una encuesta (batch) ────────────────────────
export async function enviarRespuestasEncuesta(
    respuestas: { preguntaId: string; valor: string }[]
) {
    const token = await convexAuthNextjsToken();
    if (!token) throw new Error('No autenticado.');
    
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );
    if (!currentUser) throw new Error('No autenticado.');
    
    const { email } = currentUser;
    const supabase = await createClient();

    console.log('[enviarRespuestasEncuesta] Guardando respuestas:', { email, respuestas });

    // Guardar cada respuesta individualmente para evitar problemas con upsert batch
    for (const r of respuestas) {
        const row = { preguntaId: r.preguntaId, userId: email, valor: r.valor };
        console.log('[enviarRespuestasEncuesta] Guardando:', row);
        
        const { error } = await supabase
            .from('MedicionRespuesta')
            .upsert(row, { onConflict: 'preguntaId,userId' });
        
        if (error) {
            console.error('[enviarRespuestasEncuesta] Error guardando respuesta:', error);
            throw new Error('No se pudo guardar la respuesta: ' + error.message);
        }
    }
    
    console.log('[enviarRespuestasEncuesta] Todas las respuestas guardadas');
    revalidatePath('/dashboard/encuestas');
    return { success: true };
}

// ── Listado de encuestas para gestión CMS ─────────────────────────────────────
export interface EncuestaGestion {
    bootcampId: number | string;
    bootcampTitle: string;
    bootcampIcon: string | null;
    bootcampColor: string | null;
    totalPreguntas: number;
    enviadas: number;
    pendientes: number;
    pausada: boolean;
    createdAt: string;
}

export async function getEncuestasGestion(): Promise<EncuestaGestion[]> {
    const { supabase } = await requireAdminOrDocente();

    // Get all preguntas
    const { data: preguntas } = await supabase
        .from('MedicionPregunta')
        .select('bootcampId, enviada, pausada, createdAt')
        .order('createdAt', { ascending: true });

    if (!preguntas || preguntas.length === 0) return [];

    // Get unique bootcamp IDs
    const bootcampIds = [...new Set((preguntas as any[]).map(p => p.bootcampId))];
    
    // Get bootcamps separately
    const { data: bootcamps } = await supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .in('id', bootcampIds);
    
    // Create a map of bootcamps by id (normalized to string for comparison)
    const bootcampMap: Record<string, any> = {};
    for (const bc of (bootcamps || []) as any[]) {
        bootcampMap[String(bc.id)] = bc;
    }

    const map: Record<string, EncuestaGestion> = {};
    for (const p of preguntas as any[]) {
        const bcIdStr = String(p.bootcampId);
        const bc = bootcampMap[bcIdStr];
        if (!bc) continue;
        if (!map[bcIdStr]) {
            map[bcIdStr] = {
                bootcampId: bc.id,
                bootcampTitle: bc.title,
                bootcampIcon: bc.icon ?? null,
                bootcampColor: bc.color ?? null,
                totalPreguntas: 0,
                enviadas: 0,
                pendientes: 0,
                pausada: false,
                createdAt: p.createdAt,
            };
        }
        map[bcIdStr].totalPreguntas++;
        if (p.pausada) map[bcIdStr].pausada = true;
        if (p.enviada) map[bcIdStr].enviadas++;
        else map[bcIdStr].pendientes++;
    }

    return Object.values(map);
}
