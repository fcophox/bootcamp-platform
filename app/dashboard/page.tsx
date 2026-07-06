import { createClient } from '@/utils/supabase/server';
import { DashboardClient } from './dashboard-client';
import { redirect } from 'next/navigation';
import { autoActivateStudents } from '@/app/actions/student';
import { formatDateString } from '@/utils/date';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const supabase = await createClient();

    // 1. Get current user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');
    
    // 2. Definitive check for the user's role from the database
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    const role = roleData?.role || 'alumno';

    // If the user is a teacher or admin, then they should be directed towards the CMS
    if (role === 'docente' || role === 'superadmin') {
        return redirect('/cms');
    }

    const userEmail = user.email;
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Estudiante';

    // Auto-activate any invited bootcamps whose start date has been reached
    if (userEmail) {
        await autoActivateStudents(userEmail);
    }

    // 3. Fetch bootcamps where student is enrolled by email (active or frozen)
    const { data: bootcamps, error } = await supabase
        .from('Bootcamp')
        .select(`
            *,
            BootcampStudent!inner(*)
        `)
        .eq('BootcampStudent.email', userEmail)
        .in('BootcampStudent.status', ['active', 'frozen'])
        .order('createdAt', { ascending: false });

    if (error) {
        console.error('Error fetching enrolled bootcamps:', error);
        return <DashboardClient bootcamps={[]} userName={userName} continueLearning={null} />;
    }

    const cleanedBootcamps = bootcamps?.map(b => {
        const studentRecord = Array.isArray(b.BootcampStudent) ? b.BootcampStudent[0] : b.BootcampStudent;
        const isFrozen = studentRecord?.status === 'frozen';
        
        return {
            ...b,
            startDate: formatDateString(b.startDate),
            isFrozen,
            students: Array.isArray(b.BootcampStudent) ? b.BootcampStudent.length : 0 
        };
    }) || [];

    // Fetch progress and lessons to build the "continue learning" section
    const bootcampIds = bootcamps?.map(b => b.id) || [];
    let continueLearning = null;
    const progressMap: Record<number, number> = {};

    if (bootcampIds.length > 0) {
        // Fetch all modules with lessons for these bootcamps
        const { data: modulesData } = await supabase
            .from('Module')
            .select(`
                id,
                bootcampId,
                Lesson (
                    id,
                    title,
                    type,
                    order
                )
            `)
            .in('bootcampId', bootcampIds);

        // Group lessons by bootcamp
        const lessonsMap: Record<number, any[]> = {};
        if (modulesData) {
            modulesData.forEach((mod: any) => {
                const bId = mod.bootcampId;
                if (!lessonsMap[bId]) {
                    lessonsMap[bId] = [];
                }
                if (mod.Lesson) {
                    lessonsMap[bId].push(...mod.Lesson);
                }
            });
        }

        // Fetch student completions
        const studentIds = bootcamps.map(b => {
            const studentRecord = Array.isArray(b.BootcampStudent) ? b.BootcampStudent[0] : b.BootcampStudent;
            return studentRecord?.id;
        }).filter(Boolean);

        const completionsMap: Record<number, number[]> = {};
        if (studentIds.length > 0) {
            const { data: completionsData } = await supabase
                .from('LessonCompletion')
                .select('studentId, lessonId')
                .in('studentId', studentIds);

            if (completionsData) {
                completionsData.forEach((comp: any) => {
                    const studentRecord = bootcamps.find(b => {
                        const rec = Array.isArray(b.BootcampStudent) ? b.BootcampStudent[0] : b.BootcampStudent;
                        return rec?.id === comp.studentId;
                    });
                    if (studentRecord) {
                        const bId = studentRecord.id;
                        if (!completionsMap[bId]) {
                            completionsMap[bId] = [];
                        }
                        completionsMap[bId].push(comp.lessonId);
                    }
                });
            }
        }

        // Calculate progress for each bootcamp
        bootcampIds.forEach(id => {
            const lessons = lessonsMap[id] || [];
            const completedIds = completionsMap[id] || [];
            const realLessons = lessons.filter(l => l.type !== 'subtitle');
            progressMap[id] = realLessons.length > 0 ? Math.round((completedIds.length / realLessons.length) * 100) : 0;
        });

        // Find the first bootcamp with progress or next lesson
        for (const b of cleanedBootcamps) {
            const lessons = lessonsMap[b.id] || [];
            const completedIds = completionsMap[b.id] || [];
            
            // Filter out subtitles
            const realLessons = lessons.filter(l => l.type !== 'subtitle');
            if (realLessons.length === 0) continue;

            // Sort lessons by order, then id
            realLessons.sort((a, b) => {
                if (a.order !== b.order) return a.order - b.order;
                return a.id - b.id;
            });

            // First incomplete lesson
            let nextLesson = realLessons.find(l => !completedIds.includes(l.id));
            if (!nextLesson && realLessons.length > 0) {
                nextLesson = realLessons[realLessons.length - 1]; // fallback to last
            }

            if (nextLesson) {
                continueLearning = {
                    bootcampId: b.id,
                    bootcampTitle: b.title,
                    lessonId: nextLesson.id,
                    lessonTitle: nextLesson.title,
                    completedCount: completedIds.length,
                    totalCount: realLessons.length,
                    icon: b.icon,
                    color: b.color
                };
                break;
            }
        }
    }

    const finalBootcamps = cleanedBootcamps.map(b => ({
        ...b,
        progress: progressMap[b.id] || 0
    }));

    return <DashboardClient bootcamps={finalBootcamps} userName={userName} continueLearning={continueLearning} />;
}
