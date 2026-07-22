import { createClient } from '@/utils/supabase/server';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PublicRankingClient } from './public-ranking-client';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function PublicRankingPage({
    params,
}: {
    params: { slug: string[] };
}) {
    const resolvedParams = await Promise.resolve(params);
    const slugParam = resolvedParams.slug?.[0] || '';
    
    // Extract ID from slug - could be "123-bootcamp-name" or just a Convex ID
    const idPart = slugParam.split('-')[0];
    const numericId = parseInt(idPart, 10);
    const isNumericId = !isNaN(numericId) && String(numericId) === idPart;

    // Fetch bootcamp from Convex
    const bootcamp = await fetchQuery(
        api.bootcamps.getWithModulesAndLessons,
        isNumericId ? { legacyId: numericId } : { convexId: idPart }
    );

    if (!bootcamp) {
        return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">Bootcamp no encontrado o error al cargar datos.</div>;
    }

    if (bootcamp.enableRanking === false) {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
                {/* Background ambient glows */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-md w-full text-center relative z-10 space-y-6">
                    {/* Icon container with border glow */}
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-card-bg/40 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-md mb-2 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-violet-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <span className="relative text-4xl select-none">🏆</span>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            Ranking no disponible
                        </h1>
                        <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-sm mx-auto">
                            El docente ha desactivado temporalmente la tabla de posiciones pública para este bootcamp. Por favor, vuelve a intentarlo más tarde.
                        </p>
                    </div>

                    {/* Logo/Footer decoration */}
                    <div className="pt-6 border-t border-white/5 flex flex-col items-center justify-center gap-2">
                        <div className="relative h-6 w-32">
                            <Image 
                                src="/brand/logotipo-synaptia-vertical-dark.png" 
                                alt="Synaptia Logotipo" 
                                fill 
                                className="object-contain object-center"
                                priority
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Sort modules and lessons
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

    // Fetch students - try with legacyId first, then Convex _id
    const { getStudents } = await import('@/app/actions/student');
    let students: any[] = [];
    
    if (typeof bootcamp.id === 'number') {
        students = await getStudents(bootcamp.id);
    }
    
    if (students.length === 0 && bootcamp._id) {
        students = await getStudents(bootcamp._id);
    }

    // Fetch all completions for these students
    // Use legacyId for matching with lessonCompletions.legacyStudentId
    const supabase = await createClient();
    const studentLegacyIds = students
        .map((s: any) => s.legacyId || s.id)
        .filter(Boolean);
    
    let completions: any[] = [];
    if (studentLegacyIds.length > 0) {
        const { data: completionsData, error: completionsError } = await supabase
            .from('LessonCompletion')
            .select('studentId, lessonId, completedAt')
            .in('studentId', studentLegacyIds);
        
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
