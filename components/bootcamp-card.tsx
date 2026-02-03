import Link from 'next/link';
import { Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone } from 'lucide-react';

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
    const linkHref = href || `/dashboard/bootcamp/${id}`;
    const linkText = buttonText || 'Ver detalles';

    const IconComponent = icon ? ICON_MAP[icon] || Code : null;
    const bgClass = color ? COLOR_MAP[color] || 'bg-green-500' : 'bg-green-500';

    return (
        <div
            className={`rounded-lg border border-border bg-card-bg p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 ${className || ''}`}
        >
            <div className="flex gap-4 mb-4">
                {IconComponent && (
                    <div className={`w-12 h-12 rounded-full ${bgClass} flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-black/10`}>
                        <IconComponent size={24} />
                    </div>
                )}
                <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1 line-clamp-1">
                        {title}
                    </h3>
                    <p className="text-sm text-muted line-clamp-2">
                        {description}
                    </p>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Duración:</span>
                    <span className="text-foreground font-medium">{duration}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Nivel:</span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
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

            <div className="flex gap-2">
                <Link
                    href={linkHref}
                    className="flex-1 block text-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                    {linkText}
                </Link>

                {onDelete && (
                    <button
                        onClick={() => onDelete(id)}
                        className="px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-all active:scale-[0.98]"
                        title="Eliminar bootcamp"
                    >
                        Eliminar
                    </button>
                )}
            </div>
        </div>
    );
}
