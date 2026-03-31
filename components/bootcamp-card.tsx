import Link from 'next/link';
import { Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone, MoreVertical, Trash2 } from 'lucide-react';
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
    icon?: string;
    color?: string;
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
    icon,
    color
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
            className={`relative group rounded-lg border border-border bg-card-bg p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 ${className || ''}`}
        >
            {/* Dots Menu */}
            {onDelete && (
                <div className="absolute top-4 right-4" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-1.5 rounded-full hover:bg-white/5 text-muted hover:text-foreground transition-colors"
                    >
                        <MoreVertical size={20} />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md bg-card-bg border border-border shadow-xl z-20 py-1 backdrop-blur-sm">
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
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-4 mb-4">
                {IconComponent && (
                    <div className={`w-12 h-12 rounded-full ${bgClass} flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-black/10`}>
                        <IconComponent size={24} />
                    </div>
                )}
                <div className="pr-8">
                    <h3 className="text-lg font-semibold text-foreground mb-1 line-clamp-1">
                        {title}
                    </h3>
                    <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>

            <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Duración:</span>
                    <span className="text-foreground font-medium">{duration}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Nivel:</span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                        {level}
                    </span>
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

            <div className="flex gap-3">
                <Link
                    href={linkHref}
                    className="flex-1 block text-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
                >
                    {linkText}
                </Link>
            </div>
        </div>
    );
}
