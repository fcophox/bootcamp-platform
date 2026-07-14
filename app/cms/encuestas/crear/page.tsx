import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { CrearEncuestaClient } from './crear-encuesta-client';

export const dynamic = 'force-dynamic';

export default async function CrearEncuestaPage({
    searchParams,
}: {
    searchParams: Promise<{ bootcamp?: string }>;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');

    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    const role = roleData?.role || 'alumno';
    if (role === 'alumno') return redirect('/dashboard');

    let bootcampsQuery = supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .order('title', { ascending: true });

    if (role === 'docente') {
        const { data: enrollments } = await supabase
            .from('BootcampStudent')
            .select('bootcampId')
            .eq('email', user.email || '');
        const ids = enrollments?.map(e => e.bootcampId) || [];
        if (ids.length === 0) return <CrearEncuestaClient bootcamps={[]} initialBootcampId={null} />;
        bootcampsQuery = bootcampsQuery.in('id', ids);
    }

    const { data: bootcamps } = await bootcampsQuery;

    // Contar preguntas existentes por bootcamp
    const { data: preguntas } = await supabase
        .from('MedicionPregunta')
        .select('bootcampId');

    const preguntasPorBootcamp: Record<number, number> = {};
    for (const p of preguntas || []) {
        preguntasPorBootcamp[p.bootcampId] = (preguntasPorBootcamp[p.bootcampId] || 0) + 1;
    }

    const bootcampsConConteo = (bootcamps || []).map(b => ({
        ...b,
        totalPreguntas: preguntasPorBootcamp[b.id] || 0,
    }));

    const { bootcamp } = await searchParams;
    const initialBootcampId = bootcamp ? Number(bootcamp) : null;

    return <CrearEncuestaClient bootcamps={bootcampsConConteo} initialBootcampId={initialBootcampId} />;
}
