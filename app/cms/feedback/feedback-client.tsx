'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import {
    ThumbsUp, ThumbsDown, MessageSquare, User,
    Calendar, Search, Filter, ChevronRight, ChevronDown, X, GraduationCap,
    Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone, Bot, BrainCircuit, Sparkles, Network, Terminal, Microscope, Rocket, Binary, Menu, MoreHorizontal
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
import { createClient } from '@/utils/supabase/client';
import { getAllLessonFeedback } from '@/app/actions/feedback';
import { getBootcampCurriculum } from '@/app/actions/module';
import { useRouter } from 'next/navigation';

export function slugify(text: string) {
    return text.toString().toLowerCase()
        .normalize('NFD') 
        .replace(/[\u0300-\u036f]/g, '') 
        .replace(/\s+/g, '-') 
        .replace(/[^\w-]+/g, '') 
        .replace(/--+/g, '-') 
        .replace(/^-+/, '') 
        .replace(/-+$/, '');
}

interface FeedbackItem {
    id: string;
    lessonId: number;
    userId: string;
    isLiked: boolean | null;
    comment: string | null;
    createdAt: string;
    Lesson: {
        title: string;
        Module: {
            title: string;
            Bootcamp: {
                title: string;
            }
        }
    };
    User: {
        email: string;
    };
}



export function FeedbackClient({ initialFeedbacks, slug }: { initialFeedbacks: FeedbackItem[], slug?: string }) {
    const router = useRouter();
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(initialFeedbacks);

    
    // Advanced filtering by Course (Bootcamp) and Module
    const [selectedBootcampId, setSelectedBootcampId] = useState<number | null>(null);


    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [curriculum, setCurriculum] = useState<any[] | null>(null);
    const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(false);
    const [drawerLesson, setDrawerLesson] = useState<{ id: number; title: string } | null>(null);
    

    
    // Realtime connection state
    const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-menu]')) setOpenMenuId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // List of all created bootcamps in the database
    const [bootcamps, setBootcamps] = useState<{ id: number; title: string; icon?: string; color?: string; }[]>([]);

    useEffect(() => {
        if (slug && bootcamps.length > 0) {
            const found = bootcamps.find(b => slugify(b.title) === slug);
            if (found) {
                setSelectedBootcampId(found.id);
            }
        } else if (!slug) {
            setSelectedBootcampId(null);
        }
    }, [slug, bootcamps]);

    // Subscribe to realtime database changes and fetch bootcamps list
    useEffect(() => {
        const supabase = createClient();
        setRealtimeStatus('connecting');

        const refreshData = async () => {
            try {
                const data = await getAllLessonFeedback();
                setFeedbacks(data as FeedbackItem[]);
                setRealtimeStatus('connected');
            } catch (err) {
                console.error('Error refreshing feedback data:', err);
                setRealtimeStatus('disconnected');
            }
        };

        const fetchBootcamps = async () => {
            try {
                const { data } = await supabase
                    .from('Bootcamp')
                    .select('id, title, icon, color')
                    .order('title', { ascending: true });
                if (data) {
                    setBootcamps(data);
                }
            } catch (err) {
                console.error('Error fetching bootcamps list:', err);
            }
        };

        // Perform initial sync
        refreshData();
        fetchBootcamps();

        const channel = supabase
            .channel('realtime-feedback-cms')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'LessonFeedback'
                },
                async (payload: any) => {
                    console.log('Realtime change captured:', payload);
                    await refreshData();
                }
            )
            .subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    setRealtimeStatus('connected');
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    setRealtimeStatus('disconnected');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (selectedBootcampId) {
            setIsLoadingCurriculum(true);
            getBootcampCurriculum(selectedBootcampId)
                .then(data => setCurriculum(data))
                .finally(() => setIsLoadingCurriculum(false));
        } else {
            setCurriculum(null);
            setSelectedModule(null);
        }
    }, [selectedBootcampId]);



    // Statistics filtered by selected bootcamp
    const statsBootcampTitle = bootcamps.find(b => b.id === selectedBootcampId)?.title;
    const statsFeedbacks = statsBootcampTitle
        ? feedbacks.filter(f => f.Lesson?.Module?.Bootcamp?.title === statsBootcampTitle)
        : feedbacks;

    const stats = {
        total: statsFeedbacks.length,
        likes: statsFeedbacks.filter(f => f.isLiked === true).length,
        dislikes: statsFeedbacks.filter(f => f.isLiked === false).length,
        comments: statsFeedbacks.filter(f => !!f.comment).length,
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header - Fixed */}
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background/80 backdrop-blur-md transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setIsMobileOpen(true)}
                                    className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground"
                                >
                                    <Menu size={20} />
                                </button>
                                <h2 className="text-sm font-light text-foreground">
                                    Feedback
                                </h2>
                                <div className="flex items-center gap-2 border border-border/80 bg-background/50 rounded-full px-3 py-1 text-[11px] font-medium transition-all shadow-sm">
                                    <span className="relative flex h-2 w-2">
                                        {realtimeStatus === 'connected' && (
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                        )}
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                            realtimeStatus === 'connected' ? 'bg-green-500' :
                                            realtimeStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                                        }`}></span>
                                    </span>
                                    <span className="text-muted tracking-wide uppercase text-[9px] font-black">
                                        {realtimeStatus === 'connected' ? 'Sincronizado' :
                                         realtimeStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-6xl mx-auto space-y-8">
                        <header className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                            <div className="space-y-1">
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feedback de Alumnos</h1>
                                <p className="text-muted text-sm font-light">Visualiza las reacciones y comentarios en tiempo real.</p>
                            </div>


                        </header>



                        {/* Curriculum & Feedback List */}
                        <div className="space-y-8">
                            {selectedBootcampId ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Stats Overview - Always show when bootcamp is selected */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                                        <div className="bg-card-bg border border-border p-6 rounded-2xl shadow-sm hover:border-primary/30 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
                                                    <Search size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted uppercase font-bold tracking-wider">Total Feedback</p>
                                                    <p className="text-2xl font-black text-foreground">{stats.total}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-card-bg border border-border p-6 rounded-2xl shadow-sm hover:border-green-500/30 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-green-500/10 rounded-xl text-green-500 group-hover:scale-110 transition-transform">
                                                    <ThumbsUp size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted uppercase font-bold tracking-wider">Likes</p>
                                                    <p className="text-2xl font-black text-foreground">{stats.likes}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-card-bg border border-border p-6 rounded-2xl shadow-sm hover:border-red-500/30 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-red-500/10 rounded-xl text-red-500 group-hover:scale-110 transition-transform">
                                                    <ThumbsDown size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted uppercase font-bold tracking-wider">Dislikes</p>
                                                    <p className="text-2xl font-black text-foreground">{stats.dislikes}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-card-bg border border-border p-6 rounded-2xl shadow-sm hover:border-violet-500/30 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-violet-500/10 rounded-xl text-violet-500 group-hover:scale-110 transition-transform">
                                                    <MessageSquare size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted uppercase font-bold tracking-wider">Comentarios</p>
                                                    <p className="text-2xl font-black text-foreground">{stats.comments}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Module Details - Show loading or curriculum */}
                                    {isLoadingCurriculum ? (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                            <p className="text-sm text-muted">Cargando curriculum...</p>
                                        </div>
                                    ) : curriculum && curriculum.length > 0 ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-1 h-6 bg-primary rounded-full"></div>
                                                <h2 className="text-xl font-bold text-foreground">Detalle por módulo</h2>
                                            </div>
                                            
                                            {curriculum.map((moduleItem, index) => {
                                                const moduleLessons = moduleItem.lessons || [];
                                                
                                                return (
                                                    <div key={moduleItem.id} className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-sm">
                                                        <div className="p-6 border-b border-border bg-background/30 flex items-center gap-4">
                                                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                                                                {index + 1}
                                                            </div>
                                                            <div>
                                                                <h3 className="text-lg font-bold text-foreground">
                                                                    Módulo {index + 1}: {moduleItem.title}
                                                                </h3>
                                                                <p className="text-sm text-muted">
                                                                    {moduleLessons.length} {moduleLessons.length === 1 ? 'CLASE' : 'CLASES'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="divide-y divide-border/50">
                                                            {moduleLessons.map((lesson: any, lIndex: number) => {
                                                                const lessonFeedbacks = feedbacks.filter(f => f.lessonId === lesson.id);
                                                                const likes = lessonFeedbacks.filter(f => f.isLiked === true).length;
                                                                const dislikes = lessonFeedbacks.filter(f => f.isLiked === false).length;
                                                                const commentsCount = lessonFeedbacks.filter(f => !!f.comment).length;
                                                                
                                                                return (
                                                                    <div 
                                                                        key={lesson.id} 
                                                                        onClick={() => setDrawerLesson({ id: lesson.id, title: lesson.title })}
                                                                        className="p-4 flex items-center justify-between hover:bg-hover-bg/30 transition-colors group cursor-pointer"
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-2 h-2 rounded-full bg-primary/50 group-hover:bg-primary transition-colors"></div>
                                                                            <p className="text-sm font-medium text-foreground">
                                                                                Clase {lIndex + 1}: {lesson.title}
                                                                            </p>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                            <div className="flex items-center justify-center gap-1.5 min-w-[52px] px-3 py-1 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 text-xs font-bold">
                                                                                <ThumbsUp size={12} /> {likes}
                                                                            </div>
                                                                            <div className="flex items-center justify-center gap-1.5 min-w-[52px] px-3 py-1 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold">
                                                                                <ThumbsDown size={12} /> {dislikes}
                                                                            </div>
                                                                            <div className="flex items-center justify-center gap-1.5 min-w-[52px] px-3 py-1 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20 text-xs font-bold">
                                                                                <MessageSquare size={12} /> {commentsCount}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {moduleLessons.length === 0 && (
                                                                <div className="p-4 text-sm text-muted italic text-center">
                                                                    No hay clases en este módulo
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : curriculum && curriculum.length === 0 ? (
                                        <div className="p-12 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                                            <p className="text-muted">Este bootcamp no tiene módulos o clases aún.</p>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <h2 className="text-lg font-bold text-foreground mb-6">Selecciona un Bootcamp</h2>
                                    <div className="flex flex-col border border-border rounded-xl overflow-visible">
                                        {bootcamps.map((bootcamp, i) => {
                                            const bootcampFeedbacks = feedbacks.filter(f => f.Lesson?.Module?.Bootcamp?.title === bootcamp.title);
                                            const IconComponent = bootcamp.icon ? ICON_MAP[bootcamp.icon] || Code : GraduationCap;
                                            const bgClass = bootcamp.color ? COLOR_MAP[bootcamp.color] || 'bg-primary' : 'bg-primary';
                                            return (
                                                <div key={bootcamp.id} className={`flex items-center gap-4 px-5 py-4 bg-card-bg hover:bg-hover-bg transition-colors ${i < bootcamps.length - 1 ? 'border-b border-border' : ''} ${i === 0 ? 'rounded-t-xl' : ''} ${i === bootcamps.length - 1 ? 'rounded-b-xl' : ''}`}>
                                                     <div className={`w-9 h-9 rounded-full ${bgClass} flex items-center justify-center shrink-0 text-white cursor-pointer`} onClick={() => router.push(`/cms/feedback/${slugify(bootcamp.title)}`)}>
                                                        <IconComponent size={18} />
                                                    </div>
                                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/cms/feedback/${slugify(bootcamp.title)}`)}>
                                                        <p className="text-sm font-semibold text-foreground truncate">{bootcamp.title}</p>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="text-xs text-muted">{bootcampFeedbacks.length} interacciones</span>
                                                            <span className="text-xs text-green-500">{bootcampFeedbacks.filter(f => f.isLiked === true).length} likes</span>
                                                            <span className="text-xs text-violet-500">{bootcampFeedbacks.filter(f => !!f.comment).length} comentarios</span>
                                                        </div>
                                                    </div>
                                                    {/* Menú 3 puntos */}
                                                    <div className="relative shrink-0" data-menu>
                                                        <button
                                                            onClick={() => setOpenMenuId(openMenuId === bootcamp.id ? null : bootcamp.id)}
                                                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
                                                        >
                                                            <MoreHorizontal size={16} />
                                                        </button>
                                                        {openMenuId === bootcamp.id && (
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-card-bg border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in zoom-in-95 duration-150">
                                                                <button
                                                                    onClick={() => { router.push(`/cms/feedback/${slugify(bootcamp.title)}`); setOpenMenuId(null); }}
                                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors"
                                                                >
                                                                    <ChevronRight size={14} /> Ver métricas
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {bootcamps.length === 0 && (
                                        <div className="p-12 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                                            <p className="text-muted">No hay bootcamps disponibles.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Drawer Backdrop */}
            {drawerLesson && (
                <div 
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setDrawerLesson(null)}
                />
            )}

            {/* Drawer Panel */}
            <div className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[450px] bg-card-bg border-l border-border shadow-2xl transition-transform duration-300 transform ${drawerLesson ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
                <div className="flex items-center justify-between p-6 border-b border-border bg-background/50">
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Detalle de Clase</h3>
                        <p className="text-xs text-muted font-medium truncate max-w-[300px]">{drawerLesson?.title}</p>
                    </div>
                    <button onClick={() => setDrawerLesson(null)} className="p-2 hover:bg-hover-bg rounded-full transition-colors text-muted hover:text-foreground">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {drawerLesson && feedbacks.filter(f => f.lessonId === drawerLesson.id).length > 0 ? (
                        feedbacks.filter(f => f.lessonId === drawerLesson.id).map(item => (
                            <div key={item.id} className="bg-background/50 border border-border/50 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{item.User?.email || 'Usuario Oculto'}</p>
                                            <p className="text-[10px] text-muted">
                                                {new Date(item.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px] font-black border ${
                                        item.isLiked === true ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                        item.isLiked === false ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                        'bg-zinc-500/10 text-muted border-zinc-500/20'
                                    }`}>
                                        {item.isLiked === true && <ThumbsUp size={12} fill="currentColor" />}
                                        {item.isLiked === false && <ThumbsDown size={12} fill="currentColor" />}
                                        {item.isLiked === null ? 'SIN VOTO' : (item.isLiked ? 'LIKE' : 'DISLIKE')}
                                    </div>
                                </div>
                                {item.comment && (
                                    <div className="p-4 bg-card-bg rounded-xl border border-border/50 text-sm text-foreground italic">
                                        &ldquo;{item.comment}&rdquo;
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10">
                            <MessageSquare className="mx-auto h-12 w-12 text-muted mb-3 opacity-20" />
                            <p className="text-sm text-muted">No hay interacciones para esta clase aún.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

