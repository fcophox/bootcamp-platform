'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import {
    ThumbsUp, ThumbsDown, MessageSquare, User,
    Calendar, Search, Filter, ChevronRight
} from 'lucide-react';



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

export function FeedbackClient({ initialFeedbacks }: { initialFeedbacks: FeedbackItem[] }) {

    const { isCollapsed } = useSidebar();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'liked' | 'disliked' | 'commented'>('all');

    const filteredFeedbacks = initialFeedbacks.filter((f: FeedbackItem) => {
        const matchesSearch =
            f.User.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.Lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.comment?.toLowerCase().includes(searchTerm.toLowerCase()) || false);

        const matchesFilter =
            filter === 'all' ? true :
                filter === 'liked' ? f.isLiked === true :
                    filter === 'disliked' ? f.isLiked === false :
                        filter === 'commented' ? !!f.comment : true;

        return matchesSearch && matchesFilter;
    });

    const stats = {
        total: initialFeedbacks.length,
        likes: initialFeedbacks.filter(f => f.isLiked === true).length,
        dislikes: initialFeedbacks.filter(f => f.isLiked === false).length,
        comments: initialFeedbacks.filter(f => !!f.comment).length,
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header - Fixed */}
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background/80 backdrop-blur-md transition-all duration-300 ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center justify-between h-full">
                            <h2 className="text-sm font-light text-foreground flex items-center gap-2">
                                <MessageSquare size={16} className="text-primary" />
                                CMS Feedback
                            </h2>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-6xl mx-auto space-y-8">
                        <header className="mb-10">
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">Feedback de Alumnos</h1>
                            <p className="text-muted">Visualiza las reacciones y comentarios sobre el contenido del bootcamp.</p>
                        </header>

                        {/* Stats Overview */}
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

                        {/* Filters & Search */}
                        <div className="flex flex-col md:flex-row gap-4 mb-8">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar por alumno, clase o comentario..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-card-bg border border-border rounded-xl py-3 pl-12 pr-4 text-foreground focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-card-bg border border-border p-1.5 rounded-xl">
                                {[
                                    { id: 'all', label: 'Todos', icon: Filter },
                                    { id: 'liked', label: 'Likes', icon: ThumbsUp },
                                    { id: 'disliked', label: 'Dislikes', icon: ThumbsDown },
                                    { id: 'commented', label: 'Comentarios', icon: MessageSquare },
                                ].map((btn) => (
                                    <button
                                        key={btn.id}
                                        onClick={() => setFilter(btn.id as 'all' | 'liked' | 'disliked' | 'commented')}

                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${filter === btn.id ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}
                                    >
                                        <btn.icon size={16} />
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Feedback List */}
                        <div className="space-y-4">
                            {filteredFeedbacks.length > 0 ? (
                                filteredFeedbacks.map((item: FeedbackItem) => (
                                    <div key={item.id} className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                        <div className="p-6 md:p-8">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                                                        <User size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-foreground">{item.User.email}</p>
                                                        <p className="text-xs text-muted flex items-center gap-2">
                                                            <Calendar size={12} />
                                                            {new Date(item.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-black border transition-all ${item.isLiked === true ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                        item.isLiked === false ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                            'bg-zinc-500/10 text-muted border-zinc-500/20'
                                                        }`}>
                                                        {item.isLiked === true && <ThumbsUp size={14} fill="currentColor" />}
                                                        {item.isLiked === false && <ThumbsDown size={14} fill="currentColor" />}
                                                        {item.isLiked === null ? 'SIN VOTO' : (item.isLiked ? 'ME GUSTA' : 'NO ME GUSTA')}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 md:p-6 bg-background/50 rounded-2xl border border-border/50 mb-6">
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-3 font-medium uppercase tracking-wider">
                                                    <span>{item.Lesson.Module.Bootcamp.title}</span>
                                                    <ChevronRight size={10} />
                                                    <span>{item.Lesson.Module.title}</span>
                                                </div>
                                                <h3 className="text-lg md:text-xl font-bold text-foreground">
                                                    {item.Lesson.title}
                                                </h3>
                                            </div>

                                            {item.comment ? (
                                                <div className="relative pl-6 py-2 border-l-4 border-violet-500 bg-violet-500/5 rounded-r-2xl p-6">
                                                    <MessageSquare className="absolute -left-3 top-[-10px] text-violet-500 bg-card-bg rounded-lg border border-border" size={18} />
                                                    <p className="text-foreground leading-relaxed italic text-base">&ldquo;{item.comment}&rdquo;</p>

                                                </div>
                                            ) : (
                                                <div className="p-4 text-center border-2 border-dashed border-border rounded-xl text-muted text-sm italic">
                                                    Sin comentario escrito
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-20 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                                    <div className="bg-primary/5 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary border border-primary/10">
                                        <Search size={40} />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">No se encontró feedback</h3>
                                    <p className="text-muted">Intenta ajustar los filtros o términos de búsqueda.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
