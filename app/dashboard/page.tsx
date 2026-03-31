import { createClient } from '@/utils/supabase/server';
import { DashboardClient } from './dashboard-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const supabase = await createClient();

    // 1. Get current user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');
    
    // 2. Definitive check for the user's role from the database
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    const role = roleData?.role || 'alumno';

    // If the user is a teacher or admin, then they should be directed towards the CMS
    if (role === 'docente' || role === 'superadmin') {
        return redirect('/cms');
    }

    const userEmail = user.email;
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Estudiante';

    // 3. Fetch bootcamps where student is enrolled by email
    const { data: bootcamps, error } = await supabase
        .from('Bootcamp')
        .select(`
            *,
            BootcampStudent!inner(*)
        `)
        .eq('BootcampStudent.email', userEmail)
        .eq('BootcampStudent.status', 'active')
        .order('createdAt', { ascending: false });

    if (error) {
        console.error('Error fetching enrolled bootcamps:', error);
        return <DashboardClient bootcamps={[]} userName={userName} />;
    }

    const cleanedBootcamps = bootcamps?.map(b => ({
        ...b,
        students: b.BootcampStudent?.length || 0 
    })) || [];

    return <DashboardClient bootcamps={cleanedBootcamps} userName={userName} />;
}
