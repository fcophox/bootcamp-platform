'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, User, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getAllLessonFeedback } from '@/app/actions/feedback';
import { getBootcampCurriculum } from '@/app/actions/module';

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
            };
        };
    };
    User: {
        email: string;
    };
}

interface BootcampFeedbackTabProps {
    bootcampId: number;
}

export function BootcampFeedbackTab({ bootcampId }: BootcampFeedbackTabProps) {
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [curriculum, setCurriculum] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [drawerLesson, setDrawerLesson] = useState<{ id: number; title: string } | null>(null);

    useEffect(() => {
        const supabase = createClient();

        const refreshData = async () => {
            try {
                const data = await getAllLessonFeedback();
                setFeedbacks(data as FeedbackItem[]);
                setRealtimeStatus('connected');
            } catch {
                setRealtimeStatus('disconnected');
            }
        };

        const loadCurriculum = async () => {
            try {
                const data = await getBootcampCurriculum(bootcampId);
                setCurriculum(data);
            } finally {
                setIsLoading(false);
            }
        };

        refreshData();
        loadCurriculum();

        const channel = supabase
            .channel(`realtime-feedback-tab-${bootcampId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'LessonFeedback' },
                async () => { await refreshData(); }
            )
            .subscribe((status: string) => {
                if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
                else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeStatus('disconnected');
            });

        return () => { supabase.removeChannel(channel); };
    }, [bootcampId]);

    // Filter feedbacks to this bootcamp's lessons
    const lessonIds = new Set(
        (curriculum || []).flatMap((m: any) => (m.lessons || []).map((l: any) => l.id))
    );
    const bootcampFeedbacks = feedbacks.filter(f => lessonIds.has(f.lessonId));

    const stats = {
        total: bootcampFeedbacks.length,
        likes: bootcampFeedbacks.filter(f => f.isLiked === true).length,
        dislikes: bootcampFeedbacks.filter(f => f.isLiked === false).length,
        comments: bootcampFeedbacks.filter(f => !!f.comment).length,
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm text-muted">Cargando feedback...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Realtime badge */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 border border-border/80 bg-background/50 rounded-full px-3 py-1 text-[11px] font-medium shadow-sm">
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

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card-bg border border-border p-5 rounded-2xl shadow-sm hover:border-primary/30 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
                            <MessageSquare size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Total</p>
                            <p className="text-2xl font-black text-foreground">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card-bg border border-border p-5 rounded-2xl shadow-sm hover:border-green-500/30 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-500/10 rounded-xl text-green-500 group-hover:scale-110 transition-transform">
                            <ThumbsUp size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Likes</p>
                            <p className="text-2xl font-black text-foreground">{stats.likes}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card-bg border border-border p-5 rounded-2xl shadow-sm hover:border-red-500/30 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-500/10 rounded-xl text-red-500 group-hover:scale-110 transition-transform">
                            <ThumbsDown size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Dislikes</p>
                            <p className="text-2xl font-black text-foreground">{stats.dislikes}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card-bg border border-border p-5 rounded-2xl shadow-sm hover:border-violet-500/30 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-500 group-hover:scale-110 transition-transform">
                            <MessageSquare size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Comentarios</p>
                            <p className="text-2xl font-black text-foreground">{stats.comments}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Curriculum + per-lesson feedback */}
            {curriculum && curriculum.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-primary rounded-full"></div>
                        <h2 className="text-base font-bold text-foreground">Detalle por módulo</h2>
                    </div>

                    {curriculum.map((moduleItem: any, index: number) => {
                        const moduleLessons = moduleItem.lessons || [];
                        return (
                            <div key={moduleItem.id} className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-border bg-background/30 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 text-sm">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground">Módulo {index + 1}: {moduleItem.title}</h3>
                                        <p className="text-xs text-muted">{moduleLessons.length} {moduleLessons.length === 1 ? 'clase' : 'clases'}</p>
                                    </div>
                                </div>

                                <div className="divide-y divide-border/50">
                                    {moduleLessons.map((lesson: any, lIndex: number) => {
                                        const lf = feedbacks.filter(f => f.lessonId === lesson.id);
                                        const likes = lf.filter(f => f.isLiked === true).length;
                                        const dislikes = lf.filter(f => f.isLiked === false).length;
                                        const commentsCount = lf.filter(f => !!f.comment).length;

                                        return (
                                            <div
                                                key={lesson.id}
                                                onClick={() => setDrawerLesson({ id: lesson.id, title: lesson.title })}
                                                className="p-4 flex items-center justify-between hover:bg-hover-bg/30 transition-colors group cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-primary/50 group-hover:bg-primary transition-colors shrink-0"></div>
                                                    <p className="text-sm font-medium text-foreground">Clase {lIndex + 1}: {lesson.title}</p>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 text-xs font-bold">
                                                        <ThumbsUp size={11} /> {likes}
                                                    </div>
                                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold">
                                                        <ThumbsDown size={11} /> {dislikes}
                                                    </div>
                                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20 text-xs font-bold">
                                                        <MessageSquare size={11} /> {commentsCount}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {moduleLessons.length === 0 && (
                                        <div className="p-4 text-sm text-muted italic text-center">No hay clases en este módulo</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="p-12 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                    <p className="text-muted text-sm">Este bootcamp no tiene módulos o clases aún.</p>
                </div>
            )}

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
                        <h3 className="text-base font-bold text-foreground">Detalle de Clase</h3>
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
