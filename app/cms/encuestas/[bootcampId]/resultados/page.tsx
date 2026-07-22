import { redirect } from 'next/navigation';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { createClient } from '@/utils/supabase/server';
import { getResultadosEncuesta } from '@/app/actions/medicion';
import { ResultadosEncuestaClient } from './resultados-client';

export const dynamic = 'force-dynamic';

export default async function ResultadosEncuestaPage({
    params,
}: {
    params: Promise<{ bootcampId: string }>;
}) {
    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser) return redirect('/login');

    const { role } = currentUser;
    if (role === 'alumno') return redirect('/dashboard');

    const { bootcampId } = await params;
    
    // Handle both numeric and string IDs
    const numericId = parseInt(bootcampId, 10);
    const isNumericId = !isNaN(numericId) && String(numericId) === bootcampId;

    const supabase = await createClient();
    const { data: bootcamp } = await supabase
        .from('Bootcamp')
        .select('id, title')
        .eq('id', isNumericId ? numericId : bootcampId)
        .maybeSingle();

    if (!bootcamp) return redirect('/cms/encuestas');

    // Pass the bootcampId as-is (action handles type normalization)
    const resultados = await getResultadosEncuesta(isNumericId ? numericId : bootcampId);

    return (
        <ResultadosEncuestaClient
            bootcamp={bootcamp}
            resultados={resultados}
        />
    );
}
