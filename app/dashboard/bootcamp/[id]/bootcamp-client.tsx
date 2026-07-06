'use client';

import Link from 'next/link';
import { useSidebar } from '@/components/sidebar-context';
import { MobileMenuButton } from '@/components/mobile-menu-button';
import { Sidebar } from '@/components/sidebar';
import {
    ChevronRight, ChevronDown, ChevronUp,
    BookOpen,
    Clock,
    Calendar,
    BarChart3,
    PlayCircle,
    CheckCircle,
    Star,
    Trophy,
    Headphones,
    Presentation,
    Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone, Bot, BrainCircuit, Sparkles, Network, Terminal, Microscope, Rocket, Binary,
    FileUp, Search
} from 'lucide-react';
import { useState } from 'react';

import { useBootcampProgress } from '@/app/hooks/use-bootcamp-progress';
import { formatDateString } from '@/utils/date';

// Shared Icon Map (could be in a separate util file)
const ICON_MAP: Record<string, any> = {
    code: Code,
    database: Database,
    layout: Layout,
    globe: Globe,
    server: Server,
    cloud: Cloud,
    cpu: Cpu,
    smartphone: Smartphone,
    bot: Bot,
    brain: BrainCircuit,
    sparkles: Sparkles,
    network: Network,
    terminal: Terminal,
    microscope: Microscope,
    rocket: Rocket,
    binary: Binary
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

interface StudentLesson {
    id: number;
    title: string;
    type: string;
    duration: string;
    content?: string;
    completed?: boolean;
}

const getGroupedLessons = (lessons: StudentLesson[]) => {
    const groups: { subtitle: StudentLesson | null; lessons: StudentLesson[] }[] = [];
    let currentGroup: { subtitle: StudentLesson | null; lessons: StudentLesson[] } = { subtitle: null, lessons: [] };

    (lessons || []).forEach((lesson) => {
        if (lesson.type === 'subtitle') {
            if (currentGroup.subtitle !== null || currentGroup.lessons.length > 0) {
                groups.push(currentGroup);
            }
            currentGroup = { subtitle: lesson, lessons: [] };
        } else {
            currentGroup.lessons.push(lesson);
        }
    });

    if (currentGroup.subtitle !== null || currentGroup.lessons.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
};

const getLessonDurationInfo = (lesson: any) => {
    if (lesson.duration && lesson.duration !== '10 min') {
        return lesson.duration.includes('min') ? lesson.duration : `${lesson.duration} min`;
    }

    try {
        const parsed = JSON.parse(lesson.content || '{}');
        if (parsed.settings?.duration) return `${parsed.settings.duration} min`;
        if (parsed.duration) return `${parsed.duration} min`;
    } catch {}

    switch (lesson.type) {
        case 'video':
            return '15 min';
        case 'audio':
            return '10 min';
        case 'exam':
            return '15 min';
        case 'text':
        case 'document':
        case 'file':
        default:
            const contentLen = lesson.content ? lesson.content.length : 0;
            if (contentLen === 0) return '2 min';
            const mins = Math.max(1, Math.ceil(contentLen / 500));
            return `${mins} min`;
    }
};

export default function BootcampDetailsClient({ bootcamp }: BootcampClientProps) {

    const { isCollapsed } = useSidebar();


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
    const [searchQuery, setSearchQuery] = useState('');

    // Accordion state for separators (subtitles)
    const [collapsedSeparators, setCollapsedSeparators] = useState<Record<number, boolean>>({});

    const toggleSeparator = (separatorId: number) => {
        setCollapsedSeparators(prev => ({
            ...prev,
            [separatorId]: !prev[separatorId]
        }));
    };


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
    const totalClasses = modulesToDisplay?.reduce((acc: number, m: { lessons?: { id: number; type?: string }[] }) => {
        const consumableCount = m.lessons?.filter((l: any) => l.type !== 'subtitle').length || 0;
        return acc + consumableCount;
    }, 0) || 0;


    // Use Progress Hook
    const { getProgressPercentage, isCompleted, isLoaded, toggleClassCompletion } = useBootcampProgress(bootcamp.id);
    const overallProgress = isLoaded ? getProgressPercentage(totalClasses) : (bootcamp.progress || 0);

    // Dynamic Icon and Color
    const IconComponent = ICON_MAP[bootcamp.icon] || Code;
    const bgClass = COLOR_MAP[bootcamp.color] || 'bg-green-500';
    // For shadow/gradients we can infer or map as well, strictly using bgClass for simpler implementation now



    return (
        <div className="min-h-screen bg-background">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content - with left margin for sidebar */}
            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>

                {/* Header - Fixed */}
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background transition-all duration-300 border-b border-border left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full">
                        <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-4">
                                <MobileMenuButton />
                                <nav className="flex items-center text-sm">
                                    <Link href="/dashboard" className="text-muted hover:text-foreground transition-colors">
                                        Dashboard
                                    </Link>
                                    <ChevronRight size={16} className="mx-2 text-muted" />
                                    <span className="font-medium text-foreground">Bootcamp</span>
                                </nav>
                            </div>

                            <div className="flex items-center gap-4 relative">
                                {/* Platform Status Badge */}
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 hidden md:flex">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    <span className="text-xs font-medium text-green-500">Sistema activo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto pt-[84px] px-6 pb-6 md:pt-[108px] md:px-12 md:pb-12">
                    <div className="max-w-5xl mx-auto">

                        {/* Bootcamp Hero */}
                        <div className="mb-6 md:mb-12">
                            <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
                                <div className="flex-1">
                                    {/* Logo / Icon */}
                                    <div className={`h-10 w-10 md:h-12 md:w-12 rounded-full ${bgClass} mb-4 md:mb-6 flex items-center justify-center shadow-lg text-white`}>
                                        <IconComponent className="h-5 w-5 md:h-6 md:w-6" />
                                    </div>

                                    <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2 md:mb-4 tracking-tight">{bootcamp.title}</h1>

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
                                        {/* <ChevronRight size={14} className="text-muted" /> */}
                                    </div>
                                    <p className="text-xs text-muted mb-4 md:mb-6">Inicia: {formatDateString(bootcamp.startDate)}</p>

                                    {/* Metadata Tags */}
                                    <div className="flex flex-wrap gap-3 mb-4 md:mb-8">
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

                                    <div 
                                        className="text-muted text-sm md:text-base leading-relaxed max-w-3xl prose prose-sm md:prose-base dark:prose-invert"
                                        dangerouslySetInnerHTML={{ __html: bootcamp.description }}
                                    />
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

                        {/* Plan de Estudios Title & Search */}
                        <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <BarChart3 size={24} className="text-violet-500" />
                                <h2 className="text-xl font-bold text-foreground">Plan de Estudios</h2>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar lección..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full md:w-64 pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
                                />
                            </div>
                        </div>

                        {/* Module Tabs - Minimalist Style */}
                        {modulesToDisplay && modulesToDisplay.length > 0 ? (
                            <>
                                {!searchQuery.trim() && (
                                    <div className="flex items-center gap-4 md:gap-8 mb-8 border-b border-border overflow-x-auto w-full">
                                        {modulesToDisplay.map((module: { id: number; title: string }) => (

                                            <button
                                                key={module.id}
                                                onClick={() => setActiveModule(module.id)}
                                                className={`
                                                    pb-4 text-sm font-medium transition-all relative flex-1 min-w-0 md:flex-initial text-center
                                                    ${activeModule === module.id
                                                        ? 'text-foreground border-b-2 border-foreground'
                                                        : 'text-muted hover:text-foreground/80'}
                                                `}
                                                title={module.title}
                                            >
                                                <span className="block truncate w-full">{module.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Class List */}
                                <div className="space-y-4">
                                    {(searchQuery.trim()
                                        ? modulesToDisplay.map((m: any) => ({
                                            ...m,
                                            lessons: m.lessons?.filter((l: any) => l.type !== 'subtitle' && l.title.toLowerCase().includes(searchQuery.toLowerCase())) || []
                                        })).filter((m: any) => m.lessons.length > 0)
                                        : modulesToDisplay.filter((module: { id: number }) => module.id === activeModule)
                                    ).map((module: any) => (
                                            <div key={module.id} className="space-y-6">
                                                {searchQuery.trim() && (
                                                    <h3 className="text-sm font-semibold text-primary mt-4 border-b border-border/50 pb-2">{module.title}</h3>
                                                )}
                                                {(() => {
                                                    let currentLessonNumber = 1;
                                                    return getGroupedLessons(module.lessons || []).map((group, gIndex) => (
                                                        <div key={group.subtitle?.id || `ungrouped-${gIndex}`} className="space-y-4">
                                                            {group.subtitle && (
                                                                <div className="flex items-center justify-between py-4 mt-6 mb-2 border-b border-border/20">
                                                                    <h3 className="text-md font-semibold text-muted-foreground flex items-center gap-2">
                                                                        <BookOpen size={16} className="text-muted/60" />
                                                                        {group.subtitle.title}
                                                                    </h3>
                                                                </div>
                                                            )}
                                                            <div className={group.subtitle ? "space-y-4" : "space-y-4"}>
                                                                {group.lessons.map((lesson) => {
                                                                    const index = currentLessonNumber++;

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
                                                                                <div className="flex flex-1 items-start gap-3 md:gap-6">
                                                                                    {/* Thumbnail */}
                                                                                    <div className="hidden md:flex h-20 w-20 bg-gradient-to-br from-violet-900/40 to-background rounded-lg flex-shrink-0 border border-violet-500/30 relative overflow-hidden items-center justify-center group-hover:border-violet-500/50 transition-colors">
                                                                                        <div className="absolute inset-0 bg-violet-500/10 mix-blend-overlay"></div>
                                                                                        <Trophy size={24} className="text-violet-300 relative z-10" />
                                                                                    </div>

                                                                                    <div className="pt-1 flex-1 min-w-0">
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
                                                                                                Realizar Cuestionario
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
                                                                            className="flex flex-col gap-3 group cursor-pointer bg-card-bg/40 border border-border/50 md:bg-transparent md:border-transparent p-4 md:p-2 rounded-xl transition-colors -mx-2 block hover:bg-hover-bg/30 md:flex-row md:items-start md:gap-6"
                                                                        >
                                                                            {/* Mobile View: Row 1 */}
                                                                            <div className="flex items-center gap-3 w-full md:hidden">
                                                                                <div className="h-8 w-8 rounded-full bg-border/50 flex items-center justify-center text-xs font-medium text-muted flex-shrink-0">
                                                                                    {index}
                                                                                </div>
                                                                                <h3 className="text-base font-medium text-foreground flex-1 min-w-0 truncate">
                                                                                    {lesson.title}
                                                                                </h3>
                                                                                <ChevronRight size={18} className="text-muted flex-shrink-0" />
                                                                            </div>

                                                                            {/* Mobile View: Row 2 */}
                                                                            <div className="flex items-center justify-between w-full md:hidden pl-11">
                                                                                <div className="text-xs text-muted flex items-center gap-2">
                                                                                    <span className="flex items-center gap-1">
                                                                                        <Clock size={12} />
                                                                                        {getLessonDurationInfo(lesson)}
                                                                                    </span>
                                                                                    {(isCompleted(lesson.id) || lesson.completed) && (
                                                                                        <>
                                                                                            <span className="w-1 h-1 rounded-full bg-border"></span>
                                                                                            <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                                {(bootcamp.enableChecklist !== false) && (
                                                                                    <div className="flex items-center gap-3">
                                                                                        <span className="text-xs font-medium select-none text-muted-foreground/80 whitespace-nowrap">
                                                                                            Lección lista
                                                                                        </span>
                                                                                        <button 
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                e.stopPropagation();
                                                                                                toggleClassCompletion(lesson.id);
                                                                                            }}
                                                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                                                                                isCompleted(lesson.id) ? 'bg-green-500' : 'bg-border'
                                                                                            }`}
                                                                                            title={isCompleted(lesson.id) ? "Marcar como no visto" : "Marcar como visto"}
                                                                                        >
                                                                                            <span className="sr-only">Marcar como visto</span>
                                                                                            <span
                                                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                                                                    isCompleted(lesson.id) ? 'translate-x-4' : 'translate-x-1'
                                                                                                }`}
                                                                                            />
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Desktop View */}
                                                                            <div className="hidden md:flex items-start gap-6 w-full flex-1">
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

                                                                                    <div className="pt-2 flex-1 min-w-0">
                                                                                        <h3 className="text-base font-medium text-foreground mb-2 group-hover:text-violet-400 transition-colors line-clamp-1">
                                                                                            {lesson.title}
                                                                                        </h3>
                                                                                        <p className="text-xs text-muted flex items-center gap-3">
                                                                                            <span className="flex items-center gap-1">
                                                                                                <Clock size={12} />
                                                                                                {getLessonDurationInfo(lesson)}
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

                                                                                    <div className={`self-center flex items-center gap-4 transition-opacity px-2 opacity-0 group-hover:opacity-100`}>
                                                                                        {(bootcamp.enableChecklist !== false) && (
                                                                                            <>
                                                                                                <span className={`text-xs font-medium select-none whitespace-nowrap transition-all duration-300 ${
                                                                                                    isCompleted(lesson.id) 
                                                                                                        ? 'text-muted-foreground/40' 
                                                                                                        : 'text-muted-foreground/80'
                                                                                                }`}>
                                                                                                    {isCompleted(lesson.id) ? 'Lección lista' : '¿Ya viste el contenido?'}
                                                                                                </span>
                                                                                                <button 
                                                                                                    onClick={(e) => {
                                                                                                        e.preventDefault();
                                                                                                        e.stopPropagation();
                                                                                                        toggleClassCompletion(lesson.id);
                                                                                                    }}
                                                                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                                                                                        isCompleted(lesson.id) ? 'bg-green-500' : 'bg-border'
                                                                                                    }`}
                                                                                                    title={isCompleted(lesson.id) ? "Marcar como no visto" : "Marcar como visto"}
                                                                                                >
                                                                                                    <span className="sr-only">Marcar como visto</span>
                                                                                                    <span
                                                                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                                                                            isCompleted(lesson.id) ? 'translate-x-4' : 'translate-x-1'
                                                                                                        }`}
                                                                                                    />
                                                                                                </button>
                                                                                            </>
                                                                                        )}
                                                                                        <ChevronRight size={18} className="text-muted" />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </Link>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}

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
