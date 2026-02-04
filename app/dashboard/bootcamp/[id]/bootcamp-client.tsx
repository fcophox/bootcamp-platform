'use client';

import Link from 'next/link';
import { useTheme } from "next-themes";
import { useSidebar } from '@/components/sidebar-context';
import { Sidebar } from '@/components/sidebar';
import {
    ChevronRight,
    BookOpen,
    Clock,
    Calendar,
    BarChart3,
    PlayCircle,
    FileText,
    CheckCircle,
    Star,
    Trophy,
    Headphones,
    Presentation,
    LogOut,
    Sun,
    Moon,
    User,
    Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone,
    FileUp
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useBootcampProgress } from '@/app/hooks/use-bootcamp-progress';

// Shared Icon Map (could be in a separate util file)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
    code: Code,
    database: Database,
    layout: Layout,
    globe: Globe,
    server: Server,
    cloud: Cloud,
    cpu: Cpu,
    smartphone: Smartphone
};

const COLOR_MAP: Record<string, string> = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    pink: 'bg-pink-500',
};

// Props interface
interface BootcampClientProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bootcamp: any;
}

export default function BootcampDetailsClient({ bootcamp }: BootcampClientProps) {

    const { isCollapsed } = useSidebar();
    const { setTheme, resolvedTheme } = useTheme();

    // Mock Data to Emulate Rich Content (as requested)
    const MOCK_MODULES_DATA = [
        {
            id: 1,
            title: 'Fundamentos de la Web',
            duration: '2 semanas',
            completed: true,
            lessons: [
                { id: 101, title: 'Introducción a HTML5 y Semántica', type: 'video', duration: '45 min', completed: true },
                { id: 102, title: 'Guía de referencia CSS', type: 'info', duration: '15 min read', completed: true },
                { id: 103, title: 'Podcast: Historia de la Web', type: 'audio', duration: '25 min', completed: true },
                { id: 104, title: 'Slides: Estructura DOM', type: 'presentation', duration: '12 slides', completed: false },
            ]
        },
        {
            id: 2,
            title: 'JavaScript Moderno',
            duration: '3 semanas',
            completed: false,
            lessons: [
                { id: 201, title: 'Variables, Tipos y Funciones', type: 'video', duration: '50 min', completed: true },
                { id: 202, title: 'Lectura: Scope y Hoisting', type: 'info', duration: '10 min', completed: true },
                { id: 203, title: 'DOM Manipulation', type: 'video', duration: '45 min', completed: false },
                { id: 204, title: 'Async/Await y Fetch API', type: 'video', duration: '55 min', completed: false },
                { id: 205, title: 'Entrevista: Expertos en JS', type: 'audio', duration: '30 min', completed: false },
            ]
        },
        {
            id: 3,
            title: 'React.js',
            duration: '4 semanas',
            completed: false,
            lessons: [
                { id: 301, title: 'Componentes y Props', type: 'video', duration: '50 min', completed: false },
                { id: 302, title: 'Hooks: Cheat Sheet', type: 'info', duration: '5 min', completed: false },
                { id: 303, title: 'React Router', type: 'video', duration: '40 min', completed: false },
            ]
        }
    ];

    // Use DB modules if available, otherwise fallback to MOCK_MODULES_DATA
    const modulesToDisplay = (bootcamp.modules && bootcamp.modules.length > 0)
        ? bootcamp.modules
        : MOCK_MODULES_DATA;

    const [activeModule, setActiveModule] = useState<number | null>(modulesToDisplay[0]?.id || null);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userName = 'Francisco';

    const getTypeIcon = (type: string) => {
        const t = (type || '').toLowerCase();
        switch (t) {
            case 'video': return <PlayCircle size={20} className="text-white/90" />;
            case 'audio':
            case 'podcast': return <Headphones size={20} className="text-white/90" />;
            case 'presentation': return <Presentation size={20} className="text-white/90" />;
            case 'pdf': return <FileUp size={20} className="text-white/90" />;
            case 'exam':
            case 'quiz': return <Trophy size={20} className="text-white/90" />;
            default: return <BookOpen size={20} className="text-white/90" />;
        }
    };

    // Calculate generic stats if not available in DB
    const totalModules = modulesToDisplay?.length || 0;
    const totalClasses = modulesToDisplay?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) || 0; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Use Progress Hook
    const { getProgressPercentage, isCompleted, isLoaded } = useBootcampProgress(bootcamp.id);
    const overallProgress = isLoaded ? getProgressPercentage(totalClasses) : (bootcamp.progress || 0);

    // Dynamic Icon and Color
    const IconComponent = ICON_MAP[bootcamp.icon] || Code;
    const bgClass = COLOR_MAP[bootcamp.color] || 'bg-green-500';
    // For shadow/gradients we can infer or map as well, strictly using bgClass for simpler implementation now



    return (
        <div className="min-h-screen bg-background mt-16">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content - with left margin for sidebar */}
            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>

                {/* Header - Fixed */}
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background transition-all duration-300 border-b border-border ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full">
                        <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-4">

                                <nav className="flex items-center text-sm">
                                    <Link href="/dashboard" className="text-muted hover:text-foreground transition-colors">
                                        Dashboard
                                    </Link>
                                    <ChevronRight size={16} className="mx-2 text-muted" />
                                    <span className="font-medium text-foreground">Bootcamp</span>
                                </nav>
                            </div>

                            <div className="flex items-center gap-4 relative">
                                <span className="text-sm text-muted hidden md:block">Última visita hace 10m</span>

                                {/* User Dropdown Trigger Removed */}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto pt-[60px] p-6 md:p-12">
                    <div className="max-w-5xl mx-auto">

                        {/* Bootcamp Hero */}
                        <div className="mb-12">
                            <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
                                <div className="flex-1">
                                    {/* Logo / Icon */}
                                    <div className={`h-12 w-12 rounded-full ${bgClass} mb-6 flex items-center justify-center shadow-lg text-white`}>
                                        <IconComponent size={24} />
                                    </div>

                                    <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">{bootcamp.title}</h1>

                                    {/* Rating */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex text-yellow-500">
                                            <Star size={16} fill="currentColor" />
                                            <Star size={16} fill="currentColor" />
                                            <Star size={16} fill="currentColor" />
                                            <Star size={16} fill="currentColor" />
                                            <Star size={16} fill="currentColor" />
                                        </div>
                                        <span className="text-foreground font-bold text-sm">4.6</span>
                                        <span className="text-muted text-sm border-l border-border pl-2 ml-1">1006 opiniones</span>
                                        <ChevronRight size={14} className="text-muted" />
                                    </div>
                                    <p className="text-xs text-muted mb-6">Inicia: {bootcamp.startDate}</p>

                                    {/* Metadata Tags */}
                                    <div className="flex flex-wrap gap-3 mb-8">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-lg border border-border/50 text-xs text-foreground">
                                            <BookOpen size={14} />
                                            <span>{totalModules} Módulos</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-lg border border-border/50 text-xs text-foreground">
                                            <PlayCircle size={14} />
                                            <span>{totalClasses} Clases</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-lg border border-border/50 text-xs text-foreground">
                                            <Clock size={14} />
                                            <span>{bootcamp.duration}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-lg border border-border/50 text-xs text-foreground">
                                            <Calendar size={14} />
                                            <span>Nivel: {bootcamp.level}</span>
                                        </div>
                                    </div>

                                    <p className="text-muted text-base leading-relaxed max-w-3xl">
                                        {bootcamp.description}
                                    </p>
                                </div>

                                {/* Progress Section - Top Right */}
                                <div className="flex flex-col items-end min-w-[250px] pt-4">
                                    <span className="text-xs text-muted mb-2">Progreso General</span>
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="flex-1 h-2 bg-border/30 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-violet-600 rounded-full transition-all duration-1000"
                                                style={{ width: `${overallProgress}%` }}
                                            />
                                        </div>
                                        <span className="text-xl font-bold text-violet-500">{overallProgress}%</span>
                                    </div>
                                    {overallProgress === 100 && (
                                        <Link
                                            href={`/dashboard/certificate/${bootcamp.id}`}
                                            className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:scale-105 transition-all animate-in zoom-in slide-in-from-bottom-4"
                                        >
                                            <Trophy size={16} className="fill-white/20" />
                                            Ver Mi Certificado
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Plan de Estudios Title */}
                        <div className="mb-4 flex items-center gap-3">
                            <BarChart3 size={24} className="text-violet-500" />
                            <h2 className="text-xl font-bold text-foreground">Plan de Estudios</h2>
                        </div>

                        {/* Module Tabs - Minimalist Style */}
                        {modulesToDisplay && modulesToDisplay.length > 0 ? (
                            <>
                                <div className="flex items-center gap-8 mb-8 border-b border-border overflow-x-auto">
                                    {modulesToDisplay.map((module: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                        <button
                                            key={module.id}
                                            onClick={() => setActiveModule(module.id)}
                                            className={`
                                                pb-4 text-sm font-medium transition-all relative whitespace-nowrap
                                                ${activeModule === module.id
                                                    ? 'text-foreground border-b-2 border-foreground'
                                                    : 'text-muted hover:text-foreground/80'}
                                            `}
                                        >
                                            {module.title}
                                        </button>
                                    ))}
                                </div>

                                {/* Class List for Active Module */}
                                <div className="space-y-4">
                                    {modulesToDisplay
                                        .filter((module: any) => module.id === activeModule) // eslint-disable-line @typescript-eslint/no-explicit-any
                                        .map((module: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                            <div key={module.id} className="space-y-4">
                                                {module.lessons?.map((lesson: any, lessonIndex: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                                                    const index = lessonIndex + 1;

                                                    // RENDER EXAM CARD
                                                    if (lesson.type === 'exam') {
                                                        let duration = '15 min';
                                                        let questionCount = 0;
                                                        try {
                                                            const parsed = JSON.parse(lesson.content || '{}');
                                                            if (parsed.settings?.duration) duration = `${parsed.settings.duration} min`;
                                                            if (Array.isArray(parsed.questions)) questionCount = parsed.questions.length;
                                                            else if (Array.isArray(parsed)) questionCount = parsed.length;
                                                        } catch { }

                                                        return (
                                                            <div key={lesson.id} className="flex items-start gap-6 group cursor-pointer bg-violet-500/5 hover:bg-violet-500/10 border border-violet-500/20 p-2 rounded-xl transition-all -mx-2 mt-4 mb-2">
                                                                {/* Exam Badge */}
                                                                <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 mt-2 flex-shrink-0 shadow-sm shadow-violet-500/10">
                                                                    <Trophy size={14} />
                                                                </div>

                                                                {/* Content */}
                                                                <div className="flex flex-1 items-start gap-6">
                                                                    {/* Thumbnail */}
                                                                    <div className="h-20 w-20 bg-gradient-to-br from-violet-900/40 to-background rounded-lg flex-shrink-0 border border-violet-500/30 relative overflow-hidden flex items-center justify-center group-hover:border-violet-500/50 transition-colors">
                                                                        <div className="absolute inset-0 bg-violet-500/10 mix-blend-overlay"></div>
                                                                        <Trophy size={24} className="text-violet-300 relative z-10" />
                                                                    </div>

                                                                    <div className="pt-1 flex-1">
                                                                        <h3 className="text-base font-bold text-foreground mb-1 group-hover:text-violet-300 transition-colors">
                                                                            {lesson.title}
                                                                        </h3>
                                                                        <p className="text-xs text-muted flex items-center gap-3 mt-2">
                                                                            <span className="flex items-center gap-1">
                                                                                <Clock size={12} />
                                                                                {duration}
                                                                            </span>
                                                                            <span className="w-1 h-1 rounded-full bg-border"></span>
                                                                            <span>{questionCount} Preguntas</span>
                                                                            {(isCompleted(lesson.id) || lesson.completed) && (
                                                                                <>
                                                                                    <span className="w-1 h-1 rounded-full bg-border"></span>
                                                                                    <span className="text-green-500 flex items-center gap-1 font-medium">
                                                                                        <CheckCircle size={10} /> Completado
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                        </p>
                                                                    </div>

                                                                    <div className="self-center px-4 opacity-100">
                                                                        <Link href={`/dashboard/bootcamp/${bootcamp.id}/clase/${lesson.id}`}>
                                                                            <button className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-violet-900/20 hover:shadow-violet-600/30 transform hover:-translate-y-0.5">
                                                                                Rendir Examen
                                                                            </button>
                                                                        </Link>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    // RENDER STANDARD LESSON
                                                    return (
                                                        <Link
                                                            href={`/dashboard/bootcamp/${bootcamp.id}/clase/${lesson.id}`}
                                                            key={lesson.id}
                                                            className="flex items-start gap-6 group cursor-pointer hover:bg-hover-bg/30 p-2 rounded-xl transition-colors -mx-2 block"
                                                        >
                                                            {/* Number Badge */}
                                                            <div className="h-8 w-8 rounded-full bg-border/50 flex items-center justify-center text-xs font-medium text-muted mt-5 flex-shrink-0">
                                                                {index}
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex flex-1 items-start gap-6">
                                                                {/* Thumbnail Placeholder - Square */}
                                                                <div className="h-20 w-20 bg-card-bg/80 rounded-xl flex-shrink-0 border border-border/50 relative overflow-hidden group-hover:border-violet-500/30 transition-colors flex items-center justify-center">
                                                                    <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm border border-white/10 opacity-50">
                                                                        {getTypeIcon(lesson.type)}
                                                                    </div>
                                                                </div>

                                                                <div className="pt-2 flex-1">
                                                                    <h3 className="text-base font-medium text-foreground mb-2 group-hover:text-violet-400 transition-colors line-clamp-1">
                                                                        {lesson.title}
                                                                    </h3>
                                                                    <p className="text-xs text-muted flex items-center gap-3">
                                                                        <span className="flex items-center gap-1">
                                                                            <Clock size={12} />
                                                                            {lesson.duration || '10 min'}
                                                                        </span>
                                                                        {(isCompleted(lesson.id) || lesson.completed) && (
                                                                            <>
                                                                                <span className="w-1 h-1 rounded-full bg-border"></span>
                                                                                <span className="text-green-500 flex items-center gap-1 font-medium">
                                                                                    <CheckCircle size={10} /> Completado
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </p>
                                                                </div>

                                                                <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity px-2">
                                                                    <ChevronRight size={18} className="text-muted" />
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    );
                                                })}

                                                {(!module.lessons || module.lessons.length === 0) && (
                                                    <div className="text-muted italic text-sm p-4">Este módulo aún no tiene lecciones.</div>
                                                )}
                                            </div>
                                        ))
                                    }
                                </div>
                            </>
                        ) : (
                            <div className="p-12 text-center text-muted border border-dashed border-border rounded-xl">
                                No hay módulos disponibles en este bootcamp.
                            </div>
                        )}
                    </div>
                </main>
            </div >
        </div >
    );
}
