import Link from 'next/link';
import { Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone, Bot, BrainCircuit, Sparkles, Network, Terminal, Microscope, Rocket, Binary, MoreVertical, Trash2, Copy } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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

export interface BootcampCardProps {
    id: number;
    title: string;
    description: string;
    duration: string;
    level: string;
    students: number;
    startDate: string;
    className?: string;
    href?: string;
    buttonText?: string;
    onDelete?: (id: number) => void;
    onClone?: (id: number) => void;
    icon?: string;
    color?: string;
    isFrozen?: boolean;
    imageUrl?: string;
    progress?: number;
}

export function BootcampCard({
    id,
    title,
    description,
    duration,
    level,
    students,
    startDate,
    className,
    href,
    buttonText,
    onDelete,
    onClone,
    icon,
    color,
    isFrozen,
    imageUrl,
    progress
}: BootcampCardProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const linkHref = href || `/dashboard/bootcamp/${id}`;
    const linkText = buttonText || 'Ver detalles';

    const IconComponent = icon ? ICON_MAP[icon] || Code : null;
    const bgClass = color ? COLOR_MAP[color] || 'bg-green-500' : 'bg-green-500';

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div
            className={`relative group rounded-3xl border border-border bg-card-bg transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 ${imageUrl ? 'overflow-hidden flex flex-col p-0' : 'p-6'} ${className || ''}`}
        >
            {/* Dots Menu */}
            {(onDelete || onClone) && (
                <div className="absolute top-4 right-4 z-10" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`p-1.5 rounded-full hover:bg-white/5 text-muted hover:text-foreground transition-colors ${imageUrl ? 'bg-black/40 backdrop-blur-sm' : ''}`}
                    >
                        <MoreVertical size={20} />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md bg-card-bg border border-border shadow-xl z-20 py-1 backdrop-blur-sm">
                            {onClone && (
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        onClone(id);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-white/5 flex items-center gap-2 transition-colors"
                                >
                                    <Copy size={16} className="text-muted" />
                                    Clonar
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        onDelete(id);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Eliminar
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}


            {imageUrl && (
                <div className="relative w-full h-44 overflow-hidden shrink-0">
                    <img 
                        src={imageUrl} 
                        alt={title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                    {/* Top gradient overlay to fade out/in from card background */}
                    <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-card-bg to-transparent pointer-events-none" />
                    {/* Bottom gradient overlay to fade out/in from card background */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card-bg to-transparent pointer-events-none" />
                    
                    {/* Absolutely positioned icon circle */}
                    {IconComponent && (
                        <div className={`absolute top-4 left-4 w-12 h-12 rounded-full ${bgClass} flex items-center justify-center text-white shadow-lg shadow-black/30 z-10 border border-white/10`}>
                            <IconComponent size={24} />
                        </div>
                    )}
                    
                    {/* Circular progress bar next to the icon circle */}
                    {progress !== undefined && (
                        <div className="absolute top-4 left-[72px] w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-lg shadow-black/30 z-10 border border-white/10">
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="20"
                                        cy="20"
                                        r="16"
                                        className="text-white/20"
                                        strokeWidth="3.5"
                                        stroke="currentColor"
                                        fill="transparent"
                                    />
                                    <circle
                                        cx="20"
                                        cy="20"
                                        r="16"
                                        className="text-emerald-400 transition-all duration-500"
                                        strokeWidth="3.5"
                                        strokeDasharray={2 * Math.PI * 16}
                                        strokeDashoffset={2 * Math.PI * 16 - (progress / 100) * 2 * Math.PI * 16}
                                        strokeLinecap="round"
                                        stroke="currentColor"
                                        fill="transparent"
                                    />
                                </svg>
                                <span className="absolute text-[10px] font-bold text-white font-sans">
                                    {progress}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className={imageUrl ? 'p-6 flex-1 flex flex-col justify-between' : 'h-full flex flex-col justify-between'}>
                <div>
                    <div className="flex gap-4 mb-4">
                        {(!imageUrl && IconComponent) && (
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className={`w-12 h-12 rounded-full ${bgClass} flex items-center justify-center text-white shadow-lg shadow-black/10`}>
                                    <IconComponent size={24} />
                                </div>
                                {progress !== undefined && (
                                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground border border-border shadow-sm">
                                        <div className="relative w-10 h-10 flex items-center justify-center">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle
                                                    cx="20"
                                                    cy="20"
                                                    r="16"
                                                    className="text-muted/20"
                                                    strokeWidth="3.5"
                                                    stroke="currentColor"
                                                    fill="transparent"
                                                />
                                                <circle
                                                    cx="20"
                                                    cy="20"
                                                    r="16"
                                                    className="text-emerald-500 transition-all duration-500"
                                                    strokeWidth="3.5"
                                                    strokeDasharray={2 * Math.PI * 16}
                                                    strokeDashoffset={2 * Math.PI * 16 - (progress / 100) * 2 * Math.PI * 16}
                                                    strokeLinecap="round"
                                                    stroke="currentColor"
                                                    fill="transparent"
                                                />
                                            </svg>
                                            <span className="absolute text-[10px] font-bold text-foreground font-sans">
                                                {progress}%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className={`${!imageUrl ? 'pr-8' : ''} flex-1 min-w-0`}>
                            <h3 className="text-base font-semibold text-foreground mb-1 line-clamp-1">
                                {title}
                            </h3>
                            <div 
                                className="text-xs text-muted line-clamp-2 leading-tighter prose prose-sm dark:prose-invert max-w-none mt-2"
                                dangerouslySetInnerHTML={{ __html: description }}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">Duración:</span>
                            <span className="text-foreground font-medium">{duration}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">Nivel:</span>
                            <div className="flex items-center gap-2">
                                {isFrozen && (
                                    <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                                        Congelado
                                    </span>
                                )}
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                                    {level}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">Estudiantes:</span>
                            <span className="text-foreground font-medium">{students}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">Inicio:</span>
                            <span className="text-foreground font-medium">{startDate}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-auto">
                    {isFrozen ? (
                        <button
                            disabled
                            className="flex-1 block text-center rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-semibold text-muted/60 cursor-not-allowed"
                        >
                            Acceso Congelado
                        </button>
                    ) : (
                        <Link
                            href={linkHref}
                            className="flex-1 block text-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
                        >
                            {linkText}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
