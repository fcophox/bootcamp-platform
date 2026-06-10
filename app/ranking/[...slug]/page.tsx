import { createClient } from '@/utils/supabase/server';
import { PublicRankingClient } from './public-ranking-client';

export const dynamic = 'force-dynamic';

export default async function PublicRankingPage({
    params,
}: {
    params: { slug: string[] };
}) {
    const resolvedParams = await Promise.resolve(params);
    const slugParam = resolvedParams.slug?.[0] || '';
    const id = parseInt(slugParam.split('-')[0]);

    if (isNaN(id)) {
        return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">ID de bootcamp no válido.</div>;
    }

    const supabase = await createClient();

    // Fetch bootcamp with modules and lessons
    const { data: bootcamp, error: bootcampError } = await supabase
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

    if (bootcampError || !bootcamp) {
        console.error('Error fetching bootcamp details:', bootcampError);
        return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">Bootcamp no encontrado o error al cargar datos.</div>;
    }

    // Sort modules and lessons
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

    // Fetch all completions for these students
    const studentIds = students.map((s: any) => s.id);
    let completions: any[] = [];
    if (studentIds.length > 0) {
        const { data: completionsData, error: completionsError } = await supabase
            .from('LessonCompletion')
            .select('studentId, lessonId, completedAt')
            .in('studentId', studentIds);
        
        if (!completionsError && completionsData) {
            completions = completionsData;
        }
    }

    return (
        <PublicRankingClient 
            bootcamp={bootcamp} 
            modules={modules} 
            students={students} 
            initialCompletions={completions} 
        />
    );
}
