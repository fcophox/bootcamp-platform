import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getAllCertificates } from '@/app/actions/certificate';
import { CertificadosClient } from './certificados-client';

export const dynamic = 'force-dynamic';

export default async function CertificadosPage() {
    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Get current user with role from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser || currentUser.role !== 'superadmin') {
        return redirect('/cms');
    }

    const supabase = await createClient();

    // Get all bootcamps for the select dropdown
    const { data: bootcamps } = await supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .order('title', { ascending: true });

    const certificates = await getAllCertificates();

    return <CertificadosClient certificates={certificates} bootcamps={bootcamps || []} />;
}
