import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { createClient } from '@/utils/supabase/server';
import { ManageBootcampClient } from './manage-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ManageBootcampPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = await params;
    const idParam = resolvedParams.id;
    
    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Get current user with role from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser) {
        return redirect('/login');
    }

    const { email, role } = currentUser;

    if (role === 'alumno') {
        return redirect('/dashboard');
    }

    // Parse id - could be a number (legacyId) or a Convex ID string
    const legacyId = parseInt(idParam, 10);
    const isLegacyId = !isNaN(legacyId);

    const supabase = await createClient();

    if (role === 'docente') {
        // Verify that this teacher is invited to this specific bootcamp
        const { data: enrollment } = await supabase
            .from('BootcampStudent')
            .select('id')
            .eq('bootcampId', isLegacyId ? legacyId : idParam)
            .eq('email', email)
            .maybeSingle();

        if (!enrollment) {
            return redirect('/cms');
        }
    }

    // Fetch bootcamp with modules and lessons from Convex
    const bootcamp = await fetchQuery(
        api.bootcamps.getWithModulesAndLessons,
        isLegacyId ? { legacyId } : { convexId: idParam },
        { token }
    );

    if (!bootcamp) {
        console.error('Error fetching bootcamp details: not found for id', idParam);
        return <div>Bootcamp no encontrado o error al cargar datos.</div>;
    }

    // Sort modules and lessons by 'order'
    interface Resource {
        order: number;
        id: number | string;
        lessons?: Resource[];
    }

    const modules = (bootcamp.modules || []).sort((a: Resource, b: Resource) => a.order - b.order);

    modules.forEach((mod: Resource) => {
        if (mod.lessons) {
            mod.lessons.sort((a: Resource, b: Resource) => a.order - b.order);
        }
    });

    // Fetch students - try with legacyId first, then with Convex _id
    const { getStudents } = await import('@/app/actions/student');
    
    // First try with the numeric legacyId if available
    let students = [];
    if (typeof bootcamp.id === 'number') {
        students = await getStudents(bootcamp.id);
    }
    
    // If no students found and we have a Convex _id, try with that
    if (students.length === 0 && bootcamp._id) {
        students = await getStudents(bootcamp._id);
    }
    
    // Also try with the URL param if still no students
    if (students.length === 0) {
        students = await getStudents(isLegacyId ? legacyId : idParam);
    }

    return <ManageBootcampClient bootcamp={bootcamp} modules={modules} initialStudents={students} />;
}
