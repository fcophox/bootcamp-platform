'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from 'react';
import { useSidebar } from '@/components/sidebar-context';
import { Sidebar } from '@/components/sidebar';
import { LessonExamPlayer } from '@/components/lesson-exam-player';
import {
    ChevronRight,
    ArrowLeft,
    ArrowRight,
    PlayCircle,
    Headphones,
    CheckCircle,
    CheckSquare,
    Clock,
    MessageSquare,
    ThumbsUp,
    ThumbsDown,
    Play,
    Pause,
    SkipBack,
    Presentation,
    Maximize,
    ChevronLeft,
    Trophy,
    BookOpen,
    FileUp,
    AlertCircle
} from 'lucide-react';
import { useBootcampProgress } from '@/app/hooks/use-bootcamp-progress';
import { getBootcampCurriculum } from '@/app/actions/module';
import { submitLessonFeedback, getLessonFeedback } from '@/app/actions/feedback';
import { LessonFeedbackModal } from '@/components/lesson-feedback-modal';

interface ClassItem {
    id: number;
    title: string;
    type: string;
    content: string;
    duration: string;
    completed: boolean;
    description?: string;
    imageUrl?: string;
    url?: string;
    totalSlides?: number;
}

interface Module {
    id: number;
    title: string;
    classes: ClassItem[];
}

export default function ClassPlayerPage() {
    const params = useParams();
    const router = useRouter();
    const bootcampId = params.id as string;

    const { isCollapsed } = useSidebar();
    const { setTheme, resolvedTheme } = useTheme();

    // States
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentClass, setCurrentClass] = useState<ClassItem | null>(null);
    const [currentModule, setCurrentModule] = useState<Module | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isPlaylistCollapsed, setIsPlaylistCollapsed] = useState(false);
    const [modules, setModules] = useState<Module[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userFeedback, setUserFeedback] = useState<{ isLiked: boolean | null, comment: string | null } | null>(null);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

    // Presentation State
    const [currentSlide, setCurrentSlide] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const { isCompleted: isClassCompleted, toggleClassCompletion, completedClassIds } = useBootcampProgress(Number(bootcampId));
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handleToggleComplete = () => {
        if (!currentClass) return;
        toggleClassCompletion(currentClass.id);
    };

    // Audio Sync
    useEffect(() => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying]);

    const handleNextClass = () => {
        if (!currentModule || !currentClass || !modules.length) return;

        const currentClassIndex = currentModule.classes.findIndex((c: ClassItem) => c.id === currentClass.id);

        // 1. Next class in same module
        if (currentClassIndex !== -1 && currentClassIndex < currentModule.classes.length - 1) {
            const nextClass = currentModule.classes[currentClassIndex + 1];
            router.push(`/dashboard/bootcamp/${bootcampId}/clase/${nextClass.id}`);
            return;
        }

        // 2. Next module
        const currentModuleIndex = modules.findIndex((m: Module) => m.id === currentModule.id);
        if (currentModuleIndex !== -1 && currentModuleIndex < modules.length - 1) {
            const nextModule = modules[currentModuleIndex + 1];
            if (nextModule.classes && nextModule.classes.length > 0) {
                const nextClass = nextModule.classes[0];
                router.push(`/dashboard/bootcamp/${bootcampId}/clase/${nextClass.id}`);
                return;
            }
        }

        // No next class found (Course Complete)
        router.push(`/dashboard/bootcamp/${bootcampId}`);
    };

    const classId = Number(params.classId);

    // Fetch Content
    useEffect(() => {
        const fetchContent = async () => {
            if (!bootcampId) return;
            try {
                const data = await getBootcampCurriculum(Number(bootcampId));
                // Map to match existing structure
                const formattedModules = data.map((m: { id: number; title: string, lessons: { id: number; title: string; type: string; content: string; order: number }[] }) => ({
                    id: m.id,
                    title: m.title,
                    classes: m.lessons.map((l: { id: number; title: string; type: string; content: string; order: number }) => ({
                        ...l,
                        duration: '10 min',
                        completed: false,
                    }))

                })) as Module[];

                setModules(formattedModules);
            } catch (error) {
                console.error("Error fetching content", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchContent();
    }, [bootcampId]);

    // Sync persistent progress with local state
    useEffect(() => {
        if (completedClassIds.length === 0) return;

        setModules(prev => {
            const needsUpdate = prev.some(m =>
                m.classes.some(c => (isClassCompleted(c.id) || c.completed) !== c.completed)
            );

            if (!needsUpdate) return prev;

            return prev.map(m => ({
                ...m,
                classes: m.classes.map(c => ({
                    ...c,
                    completed: isClassCompleted(c.id) || c.completed
                }))
            }));
        });

        if (currentClass) {
            const isDone = isClassCompleted(currentClass.id);
            if (currentClass.completed !== isDone) {
                setCurrentClass(prev => prev ? ({ ...prev, completed: isDone }) : null);
            }
        }
    }, [completedClassIds, isClassCompleted, currentClass]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));

        if (modules.length === 0) return () => cancelAnimationFrame(frame);

        // Find current class and module
        for (const mod of modules) {
            const foundClass = mod.classes.find((c: ClassItem) => c.id === classId);
            if (foundClass) {
                // Process the class data
                const processedClass = { ...foundClass };

                // Normalize types
                if (processedClass.type === 'text') processedClass.type = 'info';
                if (processedClass.type === 'podcast') processedClass.type = 'audio';

                // Parse content
                try {
                    if (processedClass.type === 'info') {
                        try {
                            const parsed = JSON.parse(processedClass.content);
                            if (parsed.html || parsed.imageUrl) {
                                processedClass.description = parsed.html;
                                processedClass.content = parsed.html;
                                processedClass.imageUrl = parsed.imageUrl;
                            } else {
                                processedClass.description = processedClass.content;
                            }
                        } catch {
                            processedClass.description = processedClass.content;
                        }
                    } else if (processedClass.type !== 'exam') {
                        try {
                            const parsed = JSON.parse(processedClass.content);
                             if (parsed.url !== undefined) {
                                processedClass.url = parsed.url;
                                processedClass.content = ''; // Hide URL from rendered content
                            }
                            if (parsed.html !== undefined) {
                                processedClass.description = parsed.html;
                            }
                        } catch {
                            // Simple string
                        }
                    }
                } catch {
                    // Content is simple string
                }

                setCurrentClass(processedClass);
                setCurrentModule(mod);
                setCurrentSlide(1);
                break;
            }
        }


        // Fetch user feedback
        const fetchFeedback = async () => {
            if (!classId) return;
            try {
                const feedback = await getLessonFeedback(classId);
                if (feedback) {
                    setUserFeedback({
                        isLiked: feedback.isLiked,
                        comment: feedback.comment
                    });
                } else {
                    setUserFeedback(null);
                }
            } catch (error) {
                console.error("Error fetching feedback", error);
            }
        };

        fetchFeedback();


        return () => cancelAnimationFrame(frame);
    }, [classId, modules, isLoading]);

    const handleVote = async (isLiked: boolean) => {
        if (!currentClass || isSubmittingFeedback) return;

        setIsSubmittingFeedback(true);
        // Optimistic update
        const newValue = userFeedback?.isLiked === isLiked ? null : isLiked;

        try {
            await submitLessonFeedback({
                lessonId: currentClass.id,
                bootcampId: Number(bootcampId),
                isLiked: newValue,
                comment: userFeedback?.comment
            });
            setUserFeedback(prev => ({
                isLiked: newValue,
                comment: prev?.comment || null
            }));
        } catch (error) {
            console.error("Error submitting vote", error);
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const handleCommentSubmit = async (comment: string) => {
        if (!currentClass || isSubmittingFeedback) return;

        setIsSubmittingFeedback(true);
        try {
            await submitLessonFeedback({
                lessonId: currentClass.id,
                bootcampId: Number(bootcampId),
                isLiked: userFeedback?.isLiked,
                comment: comment
            });
            setUserFeedback(prev => ({
                isLiked: prev?.isLiked || null,
                comment: comment
            }));
        } catch (error) {
            console.error("Error submitting comment", error);
            throw error;
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const nextSlide = () => {
        if (currentClass && currentSlide < (currentClass.totalSlides || 10)) {
            setCurrentSlide(prev => prev + 1);
        }
    };

    const prevSlide = () => {
        if (currentClass && currentSlide > 1) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    // Keyboard navigation for slides
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (currentClass?.type === 'presentation') {
                if (e.key === 'ArrowRight') {
                    if (currentClass && currentSlide < (currentClass.totalSlides || 10)) {
                        setCurrentSlide(prev => prev + 1);
                    }
                }
                if (e.key === 'ArrowLeft') {
                    if (currentClass && currentSlide > 1) {
                        setCurrentSlide(prev => prev - 1);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentClass, currentSlide]);


    if (isLoading) {
        return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Cargando contenido del curso...</div>;
    }

    if (!currentClass || !currentModule) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground gap-4">
                <AlertCircle size={48} className="text-red-500" />
                <h1 className="text-2xl font-bold">Clase no encontrada</h1>
                <p className="text-muted">La clase que buscas no existe o no tienes acceso.</p>
                <Link href={`/dashboard/bootcamp/${bootcampId}`} className="px-4 py-2 bg-primary text-white rounded-lg">
                    Volver al Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="h-screen bg-background overflow-hidden flex flex-col">
            <Sidebar />

            <div className={`flex flex-col h-full transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>

                <header className="h-[60px] border-b border-border bg-background flex-shrink-0 z-10 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <nav className="flex items-center text-sm truncate">
                            <Link href="/dashboard" className="text-muted hover:text-foreground transition-colors hidden md:block flex-shrink-0">
                                Dashboard
                            </Link>
                            <ChevronRight size={16} className="mx-2 text-muted hidden md:block flex-shrink-0" />
                            <Link href={`/dashboard/bootcamp/${bootcampId}`} className="text-muted hover:text-foreground transition-colors hidden md:block flex-shrink-0">
                                Bootcamp
                            </Link>
                            <ChevronRight size={16} className="mx-2 text-muted hidden md:block flex-shrink-0" />
                            <span className="font-medium text-foreground truncate">{currentClass.title}</span>
                        </nav>
                    </div>
                    {/* Dark Mode Toggle if needed */}
                    <button
                        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-lg text-muted hover:text-foreground transition-all ml-4"
                        title="Cambiar tema"
                    >
                        {mounted && resolvedTheme === 'dark' ? <Link href="#" className="flex"><BookOpen size={20} /></Link> : <Link href="#" className="flex"><BookOpen size={20} /></Link>}
                    </button>
                </header>

                <main className="flex-1 flex overflow-hidden bg-background">
                    {currentClass.type === 'exam' ? (
                        <div className="w-full h-full">
                            {(() => {
                                let questions = [];
                                let settings = { duration: 15, passingScore: 70 };
                                try {
                                    const parsed = JSON.parse(currentClass.content || '{}');
                                    if (Array.isArray(parsed)) {
                                        questions = parsed;
                                    } else {
                                        questions = parsed.questions || [];
                                        settings = { ...settings, ...parsed.settings };
                                    }
                                } catch {
                                    return <div className="p-10 text-center text-red-500">Error cargando el examen</div>;
                                }

                                return (
                                    <LessonExamPlayer
                                        title={currentClass.title}
                                        questions={questions}
                                        durationMinutes={settings.duration}
                                        passingScore={settings.passingScore}
                                        onComplete={(score: number, passed: boolean) => {
                                            if (passed && !isClassCompleted(currentClass.id)) {
                                                handleToggleComplete();
                                            }
                                        }}
                                        onNext={handleNextClass}
                                    />
                                );
                            })()}
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto h-full p-6 lg:p-8 custom-scrollbar">
                                <div className="max-w-4xl mx-auto">
                                    {(currentClass.type !== 'info' || currentClass.imageUrl) && (
                                        <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden mb-6 shadow-2xl relative group border border-white/5 bg-card-bg">
                                            {currentClass.type === 'video' && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                                    <button
                                                        onClick={() => setIsPlaying(!isPlaying)}
                                                        className="h-20 w-20 bg-primary/90 hover:bg-primary text-white rounded-full flex items-center justify-center transition-all transform group-hover:scale-110 shadow-lg shadow-primary/20 z-10"
                                                    >
                                                        {isPlaying ? <Pause fill="currentColor" size={32} /> : <Play fill="currentColor" className="ml-1" size={32} />}
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 right-0 px-4 py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="w-full h-1 bg-white/20 rounded-full mb-4 cursor-pointer">
                                                            <div className="w-1/3 h-full bg-primary rounded-full relative">
                                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full shadow-md transform scale-0 group-hover:scale-100 transition-transform"></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between text-white text-xs font-medium">
                                                            <span>12:30 / {currentClass.duration.replace(' min', ':00')}</span>
                                                            <span>HD 1080p</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {currentClass.type === 'info' && currentClass.imageUrl && (
                                                <div className="absolute inset-0 bg-card-bg flex flex-col overflow-y-auto custom-scrollbar">
                                                    <div className="w-full h-full md:h-full shrink-0 bg-zinc-900 relative">
                                                        <img
                                                            src={currentClass.imageUrl}
                                                            alt={currentClass.title}
                                                            className="w-full h-full object-contain md:object-cover"
                                                        />

                                                    </div>
                                                </div>
                                            )}

                                            {currentClass.type === 'audio' && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-black flex flex-col items-center justify-center p-8">
                                                    <div className="h-32 w-32 md:h-48 md:w-48 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl relative overflow-hidden">
                                                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
                                                        <Headphones size={64} className="text-white relative z-10" />
                                                    </div>
                                                    <h2 className="text-2xl font-bold text-white mb-2 text-center">{currentClass.title}</h2>
                                                    <p className="text-white/60 mb-8">{currentModule.title}</p>
                                                        <div className="w-full max-w-md">
                                                            <div className="w-full flex flex-col gap-2 mb-6">
                                                                <div className="flex justify-between text-[10px] font-mono text-white/40">
                                                                    <span>{formatTime(currentTime)}</span>
                                                                    <span>{formatTime(duration)}</span>
                                                                </div>
                                                                <div 
                                                                    className="h-1.5 w-full bg-white/10 rounded-full cursor-pointer relative group"
                                                                    onClick={(e) => {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const percent = (e.clientX - rect.left) / rect.width;
                                                                        if (audioRef.current) {
                                                                            audioRef.current.currentTime = percent * duration;
                                                                        }
                                                                    }}
                                                                >
                                                                    <div 
                                                                        className="h-full bg-primary rounded-full transition-all"
                                                                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                                                    ></div>
                                                                    <div className="absolute -top-1.5 -bottom-1.5 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-center gap-1 h-12 mb-6">
                                                                {[...Array(20)].map((_, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="w-1.5 bg-primary rounded-full"
                                                                        style={{
                                                                            height: isPlaying ? `${(Math.sin(i * 1324 + currentTime * 10) + 1) * 50}%` : '10%',
                                                                            opacity: isPlaying ? 1 : 0.4,
                                                                            transition: 'height 0.1s ease',
                                                                        }}
                                                                    ></div>
                                                                ))}
                                                            </div>
                                                    <div className="flex items-center justify-center gap-6">
                                                        {currentClass.url && (
                                                            <audio 
                                                                ref={audioRef} 
                                                                src={currentClass.url} 
                                                                onPlay={() => setIsPlaying(true)}
                                                                onPause={() => setIsPlaying(false)}
                                                                onEnded={() => setIsPlaying(false)}
                                                                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                                                                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                                                                className="hidden" 
                                                            />
                                                        )}
                                                        <button className="text-white/60 hover:text-white transition-colors">
                                                            <SkipBack size={24} />
                                                        </button>
                                                        <button
                                                            onClick={() => setIsPlaying(!isPlaying)}
                                                            className="h-14 w-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl shadow-white/10"
                                                        >
                                                            {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" className="ml-1" size={24} />}
                                                        </button>
                                                        <button className="text-white/60 hover:text-white transition-colors rotate-180">
                                                            <SkipBack size={24} />
                                                        </button>
                                                    </div>
                                                    </div>
                                                </div>
                                            )}

                                            {currentClass.type === 'presentation' && (
                                                <div className="absolute inset-0 bg-white dark:bg-zinc-900 flex flex-col relative text-zinc-900 dark:text-white">
                                                    <div className="flex-1 flex items-center justify-center p-8 bg-zinc-100 dark:bg-zinc-800 m-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-inner relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                                            <Presentation size={120} />
                                                        </div>
                                                        <div className="absolute bottom-4 left-6 text-xs text-muted font-mono opacity-50">
                                                            SLIDE_ID_{currentSlide.toString().padStart(3, '0')}
                                                        </div>
                                                        <div className="text-center max-w-3xl z-10">
                                                            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4">
                                                                DIAPOSITIVA {currentSlide}
                                                            </span>
                                                            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                                                                {currentSlide === 1 ? currentClass.title : `Concepto Clave #${currentSlide - 1}`}
                                                            </h2>
                                                            <p className="text-xl text-muted leading-relaxed">
                                                                {currentSlide === 1
                                                                    ? "Bienvenido a esta presentación interactiva. Utiliza los controles inferiores para navegar."
                                                                    : "Aquí se explicaría en detalle el punto importante de esta sección."}
                                                            </p>
                                                            <div className="mt-8 h-32 w-full mx-auto max-w-md bg-zinc-200 dark:bg-zinc-700/50 rounded-lg flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-600">
                                                                <span className="text-muted text-sm italic">Gráfico / Esquema Visual</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="h-16 border-t border-border bg-card-bg flex items-center justify-between px-6 select-none">
                                                        <div className="text-sm font-medium text-muted">
                                                            {currentSlide} / {currentClass.totalSlides || 12}
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <button
                                                                onClick={prevSlide}
                                                                disabled={currentSlide === 1}
                                                                className="p-2 rounded-full hover:bg-hover-bg disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                                            >
                                                                <ArrowLeft size={24} />
                                                            </button>
                                                            <button
                                                                onClick={nextSlide}
                                                                disabled={currentSlide === (currentClass.totalSlides || 12)}
                                                                className="h-10 w-10 bg-primary hover:bg-primary/90 text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-95"
                                                            >
                                                                <ArrowRight size={24} />
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button className="p-2 text-muted hover:text-foreground hover:bg-hover-bg rounded-lg transition-colors">
                                                                <Maximize size={20} />
                                                            </button>
                                                        </div>
                                                    </div >
                                                </div >
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-border pb-8 mb-8">
                                        <div>
                                            <h1 className="text-2xl font-bold text-foreground mb-2">{currentClass.title}</h1>
                                            <div className="flex items-center gap-4 text-sm text-muted">
                                                <span>{currentModule.title}</span>
                                                <span className="w-1 h-1 rounded-full bg-border"></span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} /> 
                                                    {currentClass.type === 'audio' && duration > 0 ? formatTime(duration) : currentClass.duration}
                                                </span>
                                                {currentClass.completed && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-border"></span>
                                                        <span className="text-green-500 flex items-center gap-1 font-medium"><CheckCircle size={14} /> Completado</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleVote(true)}
                                                disabled={isSubmittingFeedback}
                                                className={`p-2 rounded-lg transition-all active:scale-90 ${userFeedback?.isLiked === true ? 'text-primary bg-primary/10 shadow-sm shadow-primary/5' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
                                                title="Me gusta"
                                            >
                                                <ThumbsUp size={20} fill={userFeedback?.isLiked === true ? 'currentColor' : 'none'} />
                                            </button>
                                            <button
                                                onClick={() => handleVote(false)}
                                                disabled={isSubmittingFeedback}
                                                className={`p-2 rounded-lg transition-all active:scale-90 ${userFeedback?.isLiked === false ? 'text-red-500 bg-red-500/10 shadow-sm shadow-red-500/5' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
                                                title="No me gusta"
                                            >
                                                <ThumbsDown size={20} fill={userFeedback?.isLiked === false ? 'currentColor' : 'none'} />
                                            </button>
                                            <button
                                                onClick={() => setIsCommentModalOpen(true)}
                                                className={`p-2 rounded-lg transition-all active:scale-90 ${userFeedback?.comment ? 'text-violet-500 bg-violet-500/10 shadow-sm shadow-violet-500/5' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
                                                title="Añadir comentario"
                                            >
                                                <MessageSquare size={20} fill={userFeedback?.comment ? 'currentColor' : 'none'} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-10">
                                        {/* <h3 className="font-semibold text-foreground">Contenido</h3> */}
                                        {currentClass.description && (currentClass.type !== 'info' || !currentClass.content) && (
                                            <div className="tiptap-content max-w-none text-muted mb-8" dangerouslySetInnerHTML={{ __html: currentClass.description }} />
                                        )}

                                        {currentClass.content ? (
                                            <div className="tiptap-content max-w-none text-muted" dangerouslySetInnerHTML={{ __html: currentClass.content }} />
                                        ) : !currentClass.description && (
                                            <p className="text-muted leading-relaxed">
                                                No hay descripción adicional para esta clase.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex justify-center mb-16 pt-8 border-t border-border">
                                        <button
                                            className={`px-8 py-3 font-medium rounded-xl transition-all shadow-lg flex items-center gap-2 transform active:scale-95 ${isClassCompleted(currentClass.id)
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20'
                                                : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20 hover:scale-105'
                                                }`}
                                            onClick={handleToggleComplete}
                                        >
                                            {isClassCompleted(currentClass.id) ? (
                                                <><CheckCircle size={20} /><span>¡Clase Completada!</span></>
                                            ) : (
                                                <><CheckSquare size={20} /><span>Marcar como Visto / Leído</span></>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className={`border-t lg:border-t-0 lg:border-l border-border bg-card-bg/50 overflow-y-auto overflow-x-hidden h-full flex-shrink-0 custom-scrollbar z-20 transition-all duration-300 ${isPlaylistCollapsed ? 'w-full lg:w-14' : 'w-full lg:w-96'}`}>
                                <div className={`p-3 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex items-center ${isPlaylistCollapsed ? 'justify-center p-2' : 'justify-between'}`}>
                                    {!isPlaylistCollapsed && (
                                        <div>
                                            <h3 className="font-semibold text-foreground">Contenido del Módulo</h3>
                                            <p className="text-xs text-muted">
                                                {currentModule.classes.length} clases • Progreso: {Math.round((currentModule.classes.filter((c: ClassItem) => isClassCompleted(c.id)).length / currentModule.classes.length) * 100)}%
                                            </p>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setIsPlaylistCollapsed(!isPlaylistCollapsed)}
                                        className="p-1.5 text-muted hover:text-foreground hover:bg-hover-bg rounded-lg transition-colors"
                                    >
                                        {isPlaylistCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                                    </button>
                                </div>

                                <div className="p-2">
                                    {currentModule.classes.map((clase: ClassItem, index: number) => {
                                        const isActive = clase.id === currentClass.id;
                                        return (
                                            <Link
                                                key={clase.id}
                                                href={`/dashboard/bootcamp/${bootcampId}/clase/${clase.id}`}
                                                className={`flex rounded-xl mb-1 transition-all group ${isActive ? 'bg-primary/10 border border-primary/20' : `${isPlaylistCollapsed ? '' : 'hover:bg-hover-bg'} border border-transparent`} ${isPlaylistCollapsed ? 'justify-center p-1' : 'gap-3 p-3'}`}
                                            >
                                                <div className={`relative flex-shrink-0 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center border border-border/50 ${isPlaylistCollapsed ? 'h-10 w-10 group-hover:bg-white/10 group-hover:border-white/20 transition-all' : 'h-16 w-16'}`}>
                                                    {(() => {
                                                        const type = (clase.type || '').toLowerCase();
                                                        const size = isPlaylistCollapsed ? 18 : 20;
                                                        const className = isActive ? 'text-primary' : 'text-muted';
                                                        if (type === 'video') return <PlayCircle size={size} className={className} />;
                                                        if (type === 'audio' || type === 'podcast') return <Headphones size={size} className={className} />;
                                                        if (type === 'presentation') return <Presentation size={size} className={className} />;
                                                        if (type === 'exam' || type === 'quiz') return <Trophy size={size} className={className} />;
                                                        if (type === 'pdf') return <FileUp size={size} className={className} />;
                                                        return <BookOpen size={size} className={className} />;
                                                    })()}
                                                    {isActive && (
                                                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                                            <div className="animate-pulse w-2 h-2 bg-primary rounded-full"></div>
                                                        </div>
                                                    )}
                                                </div>
                                                {!isPlaylistCollapsed && (
                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                        <h4 className={`text-sm font-medium mb-1 line-clamp-2 ${isActive ? 'text-primary' : 'text-foreground'}`}>
                                                            {index + 1}. {clase.title}
                                                        </h4>
                                                        <div className="flex items-center gap-2 text-xs text-muted">
                                                            <span>{clase.id === currentClass.id && clase.type === 'audio' && duration > 0 ? formatTime(duration) : clase.duration}</span>
                                                            {(isClassCompleted(clase.id) || clase.completed) && <CheckCircle size={10} className="text-green-500" />}
                                                        </div>
                                                    </div>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>

            <LessonFeedbackModal
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
                onSubmit={handleCommentSubmit}
                isLoading={isSubmittingFeedback}
                initialComment={userFeedback?.comment || ''}
            />
        </div>
    );
}
