import { redirect } from 'next/navigation';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { createClient } from '@/utils/supabase/server';

export default async function BootcampLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = await params;
    const idParam = resolvedParams.id;
    
    // Parse id - could be a number (legacyId) or a Convex ID string
    const numericId = parseInt(idParam, 10);
    const isNumericId = !isNaN(numericId) && String(numericId) === idParam;

    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Get current user from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser) return redirect('/login');

    const userEmail = currentUser.email?.toLowerCase();
    
    // Get the bootcamp to find its Convex _id
    const bootcamp = await fetchQuery(
        api.bootcamps.getWithModulesAndLessons,
        isNumericId ? { legacyId: numericId } : { convexId: idParam },
        { token }
    );

    if (!bootcamp) {
        return redirect('/dashboard');
    }

    // Check enrollment using the Convex _id of the bootcamp
    const supabase = await createClient();
    
    let enrollment = null;
    
    // Try to find enrollment with the Convex _id
    const { data: enrollmentData } = await supabase
        .from('BootcampStudent')
        .select('status')
        .eq('bootcampId', bootcamp._id)
        .ilike('email', userEmail || '')
        .maybeSingle();
    
    if (enrollmentData) {
        enrollment = enrollmentData;
    } else if (isNumericId) {
        // Fallback: try with numeric ID for legacy data
        const { data } = await supabase
            .from('BootcampStudent')
            .select('status')
            .eq('bootcampId', numericId)
            .ilike('email', userEmail || '')
            .maybeSingle();
        enrollment = data;
    }

    if (!enrollment || enrollment.status !== 'active') {
        return redirect('/dashboard');
    }

    return <>{children}</>;
}
