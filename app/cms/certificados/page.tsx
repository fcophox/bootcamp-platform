import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getAllCertificates } from '@/app/actions/certificate';
import { CertificadosClient } from './certificados-client';

export const dynamic = 'force-dynamic';

export default async function CertificadosPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');

    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!roleData || roleData.role !== 'superadmin') {
        return redirect('/cms');
    }

    // Get all bootcamps for the select dropdown
    const { data: bootcamps } = await supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .order('title', { ascending: true });

    const certificates = await getAllCertificates();

    return <CertificadosClient certificates={certificates} bootcamps={bootcamps || []} />;
}
