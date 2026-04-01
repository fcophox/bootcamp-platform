import { createClient } from '@/utils/supabase/server';
import { ManageBootcampClient } from './manage-client';

export const dynamic = 'force-dynamic';

export default async function ManageBootcampPage({
    params,
}: {
    params: { id: string };
}) {
    const resolvedParams = await Promise.resolve(params);
    const id = parseInt(resolvedParams.id);
    const supabase = await createClient();

    // Fetch bootcamp with modules and lessons
    // Note: The relation names depend on how Supabase introspected the foreign keys.
    // Usually it uses the table name.
    const { data: bootcamp, error } = await supabase
        .from('Bootcamp')
        .select(`
            *,
            modules:Module (
                id,
                title,
                order,
                lessons:Lesson (
                    id,
                    title,
                    type,
                    content,
                    order
                )
            )
        `)
        .eq('id', id)
        .single();

    if (error || !bootcamp) {
        console.error('Error fetching bootcamp details:', error);
        return <div>Bootcamp no encontrado o error al cargar datos.</div>;
    }

    // Sort modules and lessons by 'order' (or id if order is default)
    // Doing it in JS because Supabase nested ordering syntax can be verbose
    interface Resource {
        order: number;
        id: number;
        lessons?: Resource[];
    }

    const modules = (bootcamp.modules || []).sort((a: Resource, b: Resource) => a.order - b.order || a.id - b.id);

    modules.forEach((mod: Resource) => {
        if (mod.lessons) {
            mod.lessons.sort((a: Resource, b: Resource) => a.order - b.order || a.id - b.id);
        }
    });


    // Fetch students
    const { getStudents } = await import('@/app/actions/student');
    const students = await getStudents(id);

    return <ManageBootcampClient bootcamp={bootcamp} modules={modules} initialStudents={students} />;
}
