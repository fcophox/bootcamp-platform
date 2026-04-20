import React from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { ChevronLeft, BarChart3, CheckCircle, Clock, BookOpen, User, Mail, Calendar, Layout } from 'lucide-react';
import { getBootcamp } from '@/app/actions/bootcamp';
import { getStudentById, getStudentCompletions, getStudentExamAttempts } from '@/app/actions/student';
import { redirect } from 'next/navigation';

interface ProgressPageProps {
    params: Promise<{
        id: string;
        studentId: string;
    }>;
}

export default async function StudentProgressPage({ params }: ProgressPageProps) {
    const { id: bootcampIdStr, studentId: studentIdStr } = await params;
    const bootcampId = parseInt(bootcampIdStr);
    const studentId = parseInt(studentIdStr);

    if (isNaN(bootcampId) || isNaN(studentId)) {
        redirect('/cms');
    }

    const [bootcamp, student, completions] = await Promise.all([
        getBootcamp(bootcampId),
        getStudentById(studentId),
        getStudentCompletions(studentId)
    ]);

    // Fetch exam attempts if student has a userId
    let examAttempts: any[] = [];
    if (student?.userId) {
        examAttempts = await getStudentExamAttempts(student.userId);
    }

    console.log(`DEBUG: Student ${studentId} (${student?.email}) has ${completions?.length || 0} completions and ${examAttempts.length} exam attempts`);

    if (!bootcamp || !student) {
        redirect(`/cms/bootcamp/${bootcampId}/manage`);
    }

    // Create a set of lesson IDs that are either in completions table OR are exams with attempts
    const completedLessonIds = new Set(completions.map(c => c.lessonId));
    
    // Add exam lessons that have attempts to the completed set
    bootcamp.modules?.forEach((module: any) => {
        module.lessons?.forEach((lesson: any) => {
            if (lesson.type === 'exam' && lesson.content) {
                const examId = parseInt(lesson.content);
                const hasAttempts = examAttempts.some(a => a.examId === examId);
                if (hasAttempts) {
                    completedLessonIds.add(lesson.id);
                }
            }
        });
    });

    const totalLessons = bootcamp.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) || 0;
    const completedLessonsCount = completedLessonIds.size;
    const overallPercentage = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;

    // Robust sorting helper
    const sortByOrder = (a: any, b: any) => {
        if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
        // Fallback: extract number from title like "Clase 1", "Clase 12"
        const numA = parseInt(a.title.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.title.match(/\d+/)?.[0] || '0');
        if (numA !== numB) return numA - numB;
        return a.title.localeCompare(b.title);
    };

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen ml-64">
                <header className="h-[60px] border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center px-6 gap-4">
                    <Link 
                        href={`/cms/bootcamp/${bootcampId}/manage`}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-muted hover:text-foreground"
                    >
                        <ChevronLeft size={20} />
                    </Link>
                    <div className="h-6 w-px bg-border mx-1" />
                    <h1 className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 size={16} className="text-primary" />
                        Progreso del Alumno
                    </h1>
                </header>

                <main className="p-8 max-w-5xl mx-auto w-full space-y-8">
                    {/* Student Summary Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 bg-card-bg border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500" />
                            
                            <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-1">
                                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-2xl">
                                    <User size={40} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{student.email.split('@')[0]}</h2>
                                    <p className="text-muted flex items-center gap-2 text-sm">
                                        <Mail size={14} className="text-primary/60" />
                                        {student.email}
                                    </p>
                                    <div className="flex flex-wrap gap-4 mt-2">
                                        <div className="flex items-center gap-2 text-xs text-muted/80">
                                            <Calendar size={14} className="text-primary/60" />
                                            <span>Invitado el {new Date(student.invitedAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted/80">
                                            <Layout size={14} className="text-primary/60" />
                                            <span>Bootcamp: {bootcamp.title}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card-bg border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-center items-center text-center space-y-4">
                            <div className="relative h-28 w-28 flex items-center justify-center">
                                <svg className="transform -rotate-90 w-28 h-28">
                                    <circle
                                        cx="56"
                                        cy="56"
                                        r="48"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        className="text-white/5"
                                    />
                                    <circle
                                        cx="56"
                                        cy="56"
                                        r="48"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        strokeDasharray={2 * Math.PI * 48}
                                        strokeDashoffset={2 * Math.PI * 48 * (1 - overallPercentage / 100)}
                                        className="text-primary transition-all duration-1000 ease-out"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className="absolute text-2xl font-bold text-foreground">{overallPercentage}%</span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Progreso General</p>
                                <p className="text-xs text-muted">{completedLessonsCount} de {totalLessons} clases</p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Detail by Module */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <BookOpen size={20} className="text-primary" />
                                Detalle por Módulo
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {bootcamp.modules?.sort(sortByOrder).map((module: any) => {
                                const moduleLessons = module.lessons || [];
                                const moduleTotal = moduleLessons.length;
                                const moduleCompleted = moduleLessons.filter((l: any) => completedLessonIds.has(l.id)).length;
                                const modulePercentage = moduleTotal > 0 ? Math.round((moduleCompleted / moduleTotal) * 100) : 0;

                                return (
                                    <div key={module.id} className="bg-card-bg/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                                        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                    {module.order || '0'}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-foreground">{module.title}</h4>
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{moduleTotal} Clases</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-sm font-bold text-foreground">{modulePercentage}%</p>
                                                    <div className="w-32 h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                                                        <div 
                                                            className="h-full bg-primary rounded-full transition-all duration-700" 
                                                            style={{ width: `${modulePercentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-white/5">
                                            {moduleLessons.sort(sortByOrder).map((lesson: any) => {
                                                const completion = completions.find(c => c.lessonId === lesson.id);
                                                const isDone = completedLessonIds.has(lesson.id);
                                                
                                                // Get attempts list for tooltip regardless of isDone (though they correlate)
                                                let attemptsList: any[] = [];
                                                if (lesson.type === 'exam' && lesson.content) {
                                                    const examId = parseInt(lesson.content);
                                                    attemptsList = examAttempts.filter(a => a.examId === examId);
                                                }
                                                
                                                return (
                                                    <div key={lesson.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`h-2 w-2 rounded-full ${isDone ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-white/10'}`} />
                                                            <span className={`text-sm ${isDone ? 'text-foreground' : 'text-muted-foreground'}`}>{lesson.title}</span>
                                                            <span className="text-[10px] bg-white/5 text-muted px-2 py-0.5 rounded-md uppercase font-bold tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {lesson.type}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {isDone ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-muted-foreground italic hidden md:block">
                                                                        {lesson.type === 'exam' 
                                                                            ? `${attemptsList.length} ${attemptsList.length === 1 ? 'intento' : 'intentos'}`
                                                                            : completion ? `Finalizada el ${new Date(completion.completedAt).toLocaleDateString()}` : 'Finalizada'
                                                                        }
                                                                    </span>
                                                                    <div className="relative group/tooltip">
                                                                        <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 cursor-help">
                                                                            <CheckCircle size={14} />
                                                                        </div>
                                                                        
                                                                        {lesson.type === 'exam' && attemptsList.length > 0 && (
                                                                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-background border border-white/10 rounded-xl shadow-2xl p-3 z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all pointer-events-none translate-y-1 group-hover/tooltip:translate-y-0">
                                                                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Intentos del Examen</p>
                                                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                                                    {attemptsList.map((att, idx) => (
                                                                                        <div key={att.id} className="flex items-center justify-between text-[11px] border-b border-white/5 pb-1">
                                                                                            <span className="text-muted">Intento {attemptsList.length - idx}</span>
                                                                                            <span className="font-bold text-foreground">Nota: {att.score} pts</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center text-muted/30">
                                                                    <Clock size={12} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {(!bootcamp.modules || bootcamp.modules.length === 0) && (
                                <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                    <p className="text-muted italic text-sm">Este bootcamp aún no tiene módulos configurados.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
