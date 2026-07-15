'use client';

import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { ArrowLeft, FileText, Download, Video, Menu, ExternalLink, Image as ImageIcon, Archive, FileCode } from 'lucide-react';

interface Material {
    name: string;
    url: string;
}

interface Props {
    bootcamp: { id: number; title: string };
    masterclass: {
        videoUrl?: string | null;
        description?: string | null;
        materials?: Material[];
    };
}

function getVideoEmbed(url: string): string | null {
    if (url.includes('youtube') || url.includes('youtu.be')) {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        return match ? `https://www.youtube.com/embed/${match[1]}` : null;
    }
    if (url.includes('vimeo')) {
        const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
        return match ? `https://player.vimeo.com/video/${match[1]}` : null;
    }
    return null; // direct URL
}

function getMaterialIcon(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) return <ImageIcon size={20} className="text-blue-400" />;
    if (['zip', 'rar'].includes(ext || '')) return <Archive size={20} className="text-amber-400" />;
    if (['md', 'txt'].includes(ext || '')) return <FileCode size={20} className="text-green-400" />;
    return <FileText size={20} className="text-red-400" />;
}

export default function MasterclassClient({ bootcamp, masterclass }: Props) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const embedUrl = masterclass.videoUrl ? getVideoEmbed(masterclass.videoUrl) : null;
    const isDirectVideo = masterclass.videoUrl && !embedUrl;

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background border-b border-border transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full">
                        <div className="flex items-center h-full gap-2">
                            <button onClick={() => setIsMobileOpen(true)} className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground">
                                <Menu size={20} />
                            </button>
                            <Link href={`/dashboard/bootcamp/${bootcamp.id}`} className="p-1.5 rounded-lg text-muted hover:text-foreground transition-colors">
                                <ArrowLeft size={16} />
                            </Link>
                            <Link href={`/dashboard/bootcamp/${bootcamp.id}`} className="text-xs text-muted hover:text-foreground transition-colors truncate max-w-[120px]">
                                {bootcamp.title}
                            </Link>
                            <span className="text-muted text-xs">/</span>
                            <span className="text-xs text-foreground font-medium flex items-center gap-1.5">
                                <Video size={13} className="text-violet-400" /> Masterclass
                            </span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-4 md:px-8 pb-10">
                    <div className="max-w-4xl mx-auto space-y-6">

                        {/* Título */}
                        <div>
                            <h1 className="text-xl font-bold text-foreground">{bootcamp.title}</h1>
                            <p className="text-sm text-muted mt-0.5 flex items-center gap-1.5">
                                <Video size={13} className="text-violet-400" /> Masterclass
                            </p>
                        </div>

                        {/* Player */}
                        <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                            {embedUrl ? (
                                <iframe
                                    src={embedUrl}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : isDirectVideo ? (
                                <video
                                    src={masterclass.videoUrl!}
                                    controls
                                    className="w-full h-full"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted">
                                    <Video size={48} className="opacity-20" />
                                </div>
                            )}
                        </div>

                        {/* Descripción */}
                        {masterclass.description && (
                            <div className="bg-card-bg border border-border rounded-2xl p-6">
                                <h2 className="text-sm font-semibold text-foreground mb-3">Descripción</h2>
                                <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{masterclass.description}</p>
                            </div>
                        )}

                        {/* Materiales */}
                        {masterclass.materials && masterclass.materials.length > 0 && (
                            <div className="bg-card-bg border border-border rounded-2xl p-6">
                                <h2 className="text-sm font-semibold text-foreground mb-4">
                                    Material de apoyo <span className="text-muted font-normal">({masterclass.materials.length})</span>
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {masterclass.materials.map((mat, i) => (
                                        <a
                                            key={i}
                                            href={mat.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background/50 hover:bg-hover-bg hover:border-primary/30 transition-all group"
                                        >
                                            <div className="shrink-0">
                                                {getMaterialIcon(mat.name)}
                                            </div>
                                            <span className="text-sm font-medium text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                                                {mat.name}
                                            </span>
                                            <ExternalLink size={13} className="text-muted shrink-0 group-hover:text-primary transition-colors" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
}
