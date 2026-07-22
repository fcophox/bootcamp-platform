import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { CrearEncuestaClient } from './crear-encuesta-client';

export const dynamic = 'force-dynamic';

export default async function CrearEncuestaPage({
    searchParams,
}: {
    searchParams: Promise<{ bootcamp?: string }>;
}) {
    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Get current user with role from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser || currentUser.role === 'alumno') {
        return redirect('/dashboard');
    }

    const { email, role } = currentUser;
    const supabase = await createClient();

    let bootcampsQuery = supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .order('title', { ascending: true });

    if (role === 'docente') {
        const { data: enrollments } = await supabase
            .from('BootcampStudent')
            .select('bootcampId')
            .eq('email', email);
        const ids = ((enrollments as any[]) || []).map((e: any) => e.bootcampId);
        if (ids.length === 0) return <CrearEncuestaClient bootcamps={[]} initialBootcampId={null} />;
        bootcampsQuery = bootcampsQuery.in('id', ids);
    }

    const { data: bootcamps } = await bootcampsQuery;

    // Contar preguntas existentes por bootcamp
    const { data: preguntas } = await supabase
        .from('MedicionPregunta')
        .select('bootcampId');

    const preguntasPorBootcamp: Record<number, number> = {};
    for (const p of (preguntas as any[]) || []) {
        preguntasPorBootcamp[p.bootcampId] = (preguntasPorBootcamp[p.bootcampId] || 0) + 1;
    }

    const bootcampsConConteo = ((bootcamps as any[]) || []).map((b: any) => ({
        ...b,
        totalPreguntas: preguntasPorBootcamp[b.id] || 0,
    }));

    const { bootcamp } = await searchParams;
    // Keep as string if it's a Convex ID, convert to number only if it's numeric
    const initialBootcampId = bootcamp 
        ? (isNaN(Number(bootcamp)) ? bootcamp : Number(bootcamp)) 
        : null;

    return <CrearEncuestaClient bootcamps={bootcampsConConteo} initialBootcampId={initialBootcampId} />;
}
