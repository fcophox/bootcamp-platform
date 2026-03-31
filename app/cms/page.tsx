import { createClient } from '@/utils/supabase/server';
import { CmsClient } from './cms-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CmsPage() {
    const supabase = await createClient();

    // Verification of the user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');

    // Definitive check for the user's role from the database
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    const role = roleData?.role || 'alumno';

    // If the user is a student, then they should be directed towards the student dashboard
    if (role === 'alumno') {
        return redirect('/dashboard');
    }

    const { data: bootcamps, error } = await supabase
        .from('Bootcamp')
        .select('*')
        .order('createdAt', { ascending: false });

    if (error) {
        console.error('Error fetching bootcamps:', error);
        return <CmsClient bootcamps={[]} />;
    }

    return <CmsClient bootcamps={bootcamps || []} />;
}
