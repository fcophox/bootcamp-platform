import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { EditCertificateClient } from './edit-client';
import { getCertificateById } from '@/app/actions/certificate';

export default async function EditCertificatePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Get current user with role from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser || currentUser.role !== 'superadmin') {
        return redirect('/dashboard');
    }

    // Get certificate - handle both numeric and string IDs
    const certificate = await getCertificateById(id);
    if (!certificate) {
        redirect('/cms/certificados');
    }

    // Get all bootcamps for the selector
    const supabase = await createClient();
    const { data: bootcamps } = await supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .order('title');

    return <EditCertificateClient certificate={certificate} bootcamps={bootcamps || []} />;
}
