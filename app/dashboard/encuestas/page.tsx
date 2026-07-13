import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getEncuestasAlumno } from '@/app/actions/medicion';
import { EncuestasClient } from './encuestas-client';

export const dynamic = 'force-dynamic';

export default async function EncuestasPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');

    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    const role = roleData?.role || 'alumno';
    if (role === 'docente' || role === 'superadmin') return redirect('/cms');

    const encuestas = await getEncuestasAlumno();

    return <EncuestasClient encuestas={encuestas} />;
}
