import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { EncuestasGestionClient } from './encuestas-gestion-client';
import { getEncuestasGestion } from '@/app/actions/medicion';

export const dynamic = 'force-dynamic';

export default async function EncuestasGestionPage() {
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

    const encuestas = await getEncuestasGestion();

    return <EncuestasGestionClient encuestas={encuestas} />;
}
