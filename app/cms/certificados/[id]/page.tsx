import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { EditCertificateClient } from './edit-client';
import { getCertificateById } from '@/app/actions/certificate';

export default async function EditCertificatePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        redirect('/sign-in');
    }

    // Check user role
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!roleData || roleData.role !== 'superadmin') {
        redirect('/dashboard');
    }

    // Get certificate
    const certificate = await getCertificateById(parseInt(id));
    if (!certificate) {
        redirect('/cms/certificados');
    }

    // Get all bootcamps for the selector
    const { data: bootcamps } = await supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .order('title');

    return <EditCertificateClient certificate={certificate} bootcamps={bootcamps || []} />;
}
