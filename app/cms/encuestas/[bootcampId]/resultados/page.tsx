import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getResultadosEncuesta } from '@/app/actions/medicion';
import { ResultadosEncuestaClient } from './resultados-client';

export const dynamic = 'force-dynamic';

export default async function ResultadosEncuestaPage({
    params,
}: {
    params: Promise<{ bootcampId: string }>;
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

    const { bootcampId } = await params;
    const id = Number(bootcampId);

    const { data: bootcamp } = await supabase
        .from('Bootcamp')
        .select('id, title')
        .eq('id', id)
        .maybeSingle();

    if (!bootcamp) return redirect('/cms/encuestas');

    const resultados = await getResultadosEncuesta(id);

    return (
        <ResultadosEncuestaClient
            bootcamp={bootcamp}
            resultados={resultados}
        />
    );
}
