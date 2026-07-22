'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useOnlineUsers } from '@/contexts/OnlineUsersContext';
import { Trophy, Activity, Share2, Check, Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone, Bot, BrainCircuit, Sparkles, Network, Terminal, Microscope, Rocket, Binary, Clock, BarChart2, Calendar, Users } from 'lucide-react';
import { formatDateString } from '@/utils/date';

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

interface Student {
    id: number | string;
    legacyId?: number;
    email: string;
    status: string;
    joinedAt?: string;
    role?: string;
}

interface Module {
    id: number | string;
    title: string;
    lessons?: {
        id: number | string;
        title: string;
        type?: string;
        content?: string;
    }[];
}

interface PublicRankingClientProps {
    bootcamp: {
        id: number | string;
        title: string;
        startDate?: string;
        duration?: string;
        level?: string;
        icon?: string;
        color?: string;
    };
    modules: Module[];
    students: Student[];
    initialCompletions: { studentId: number | string; lessonId: number | string; completedAt: string | number }[];
}

export function PublicRankingClient({
    bootcamp,
    modules,
    students,
    initialCompletions,
}: PublicRankingClientProps) {
    const { onlineUsers } = useOnlineUsers();
    const [copied, setCopied] = useState(false);
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

    const IconComponent = bootcamp.icon ? ICON_MAP[bootcamp.icon] || Code : null;
    const bgClass = bootcamp.color ? COLOR_MAP[bootcamp.color] || 'bg-green-500' : 'bg-green-500';

    // Process completions to build ranking data
    const rankingData = (() => {
        const totalLessons = modules.flatMap(m => m.lessons || []).filter(l => l.type !== 'subtitle');
        const totalWeight = totalLessons.reduce((acc, l) => {
            let weight = 1;
            if (l.type === 'check') {
                try {
                    const parsed = JSON.parse(l.content || '{}');
                    weight = Number(parsed.value) || 1;
                } catch {}
            }
            return acc + weight;
        }, 0);
        
        // Only show active students in ranking
        const activeStudents = students.filter(s => s.status === 'active' && s.role === 'alumno');

        const data = activeStudents.map(student => {
            // Use legacyId for matching completions, fallback to id
            const studentKey = String(student.legacyId || student.id);
            const studentCompletions = initialCompletions.filter(c => String(c.studentId) === studentKey);
            // Unique completions to avoid double points for same lesson, excluding subtitles
            // Normalize IDs to strings for comparison
            const uniqueCompletedLessons = Array.from(new Set(studentCompletions.map(c => c.lessonId)))
                .filter(id => totalLessons.some(l => String(l.id) === String(id)));
            
            let studentPoints = 0;
            uniqueCompletedLessons.forEach(lessonId => {
                const lesson = totalLessons.find(l => String(l.id) === String(lessonId));
                if (lesson) {
                    if (lesson.type === 'check') {
                        try {
                            const parsed = JSON.parse(lesson.content || '{}');
                            studentPoints += Number(parsed.value) || 1;
                        } catch {
                            studentPoints += 1;
                        }
                    } else {
                        studentPoints += 1;
                    }
                } else {
                    studentPoints += 1;
                }
            });
            
            return {
                student,
                points: studentPoints,
                completedLessonIds: uniqueCompletedLessons,
            };
        });

        // Sort by points descending, then by email alphabetically
        return data.sort((a, b) => b.points - a.points || a.student.email.localeCompare(b.student.email));
    })();

    // Process completions list for activity chart - only for active students
    // Use legacyId for matching
    const activeStudentKeys = new Set(
        students
            .filter(s => s.status === 'active' && s.role === 'alumno')
            .map(s => String(s.legacyId || s.id))
    );
    const completionsList = initialCompletions.filter(c => activeStudentKeys.has(String(c.studentId)));

    // Process chart data - timeline from start date to current date
    const chartData = (() => {
        const parseStartDate = (startDateStr?: string | null): Date => {
            if (!startDateStr) {
                return new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
            }
            const parts = startDateStr.split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                    return new Date(year, month, day);
                }
            }
            const date = new Date(startDateStr);
            if (!isNaN(date.getTime())) {
                return date;
            }
            return new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let start = parseStartDate(bootcamp.startDate);
        start.setHours(0, 0, 0, 0);

        if (start > today) {
            start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
        } else if (start.getTime() === today.getTime()) {
            start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
        }

        const getLocalDateString = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const counts: Record<string, number> = {};
        completionsList.forEach(c => {
            if (c.completedAt) {
                const date = new Date(c.completedAt);
                if (!isNaN(date.getTime())) {
                    const key = getLocalDateString(date);
                    counts[key] = (counts[key] || 0) + 1;
                }
            }
        });

        const data = [];
        const current = new Date(start.getTime());
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        let safety = 0;
        while (current <= today && safety < 1000) {
            safety++;
            const key = getLocalDateString(current);
            data.push({
                label: `${current.getDate()} ${months[current.getMonth()]}`,
                value: counts[key] || 0
            });
            current.setDate(current.getDate() + 1);
        }

        return data;
    })();

    // Compute SVG constants for line chart
    const svgWidth = 500;
    const svgHeight = 120;
    const svgPadding = { top: 15, right: 15, bottom: 25, left: 30 };
    const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
    const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
    const maxChartValue = Math.max(...chartData.map(d => d.value), 4);

    const chartPoints = chartData.map((d, index) => {
        const x = svgPadding.left + (index / (chartData.length - 1 || 1)) * chartWidth;
        const y = svgPadding.top + chartHeight - (d.value / maxChartValue) * chartHeight;
        return { x, y, label: d.label, value: d.value };
    });

    const chartGridLines = [0, 1, 2, 3].map(i => {
        const val = (maxChartValue / 3) * i;
        const y = svgPadding.top + chartHeight - (val / maxChartValue) * chartHeight;
        return { y, value: Math.round(val) };
    });

    let chartLineD = '';
    let chartAreaD = '';
    if (chartPoints.length > 0) {
        chartLineD = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
        for (let i = 0; i < chartPoints.length - 1; i++) {
            const p0 = chartPoints[i];
            const p1 = chartPoints[i + 1];
            const cp1x = p0.x + (p1.x - p0.x) / 3;
            const cp1y = p0.y;
            const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
            const cp2y = p1.y;
            chartLineD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
        }
        chartAreaD = `${chartLineD} L ${chartPoints[chartPoints.length - 1].x} ${svgPadding.top + chartHeight} L ${chartPoints[0].x} ${svgPadding.top + chartHeight} Z`;
    }

    const handleShare = () => {
        if (typeof window === 'undefined') return;
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground pt-10 pb-6 px-4 md:px-8">
            <div className="max-w-4xl mx-auto flex-1 w-full flex flex-col gap-8">
                
                {/* Logo Superior */}
                <div className="flex justify-center sm:justify-start">
                    <div className="relative h-10 w-48">
                        <Image 
                            src="/brand/logotipo-synaptia-vertical-dark.png" 
                            alt="Synaptia Logotipo" 
                            fill 
                            className="object-contain object-center sm:object-left"
                            priority
                        />
                    </div>
                </div>

                {/* Public Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                                Ranking Público
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                            {IconComponent && (
                                <div className={`w-10 h-10 rounded-full ${bgClass} flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-black/10`}>
                                    <IconComponent size={20} />
                                </div>
                            )}
                            <span>{bootcamp.title}</span>
                        </h1>

                        {/* Bootcamp Info Metadata Badges */}
                        <div className="flex flex-wrap items-center gap-3 mt-4">
                            {bootcamp.duration && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/40 bg-card-bg/20 text-xs text-muted-foreground font-medium backdrop-blur-sm">
                                    <Clock size={14} className="text-primary/70" />
                                    <span>{bootcamp.duration}</span>
                                </div>
                            )}
                            {bootcamp.level && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/40 bg-card-bg/20 text-xs text-muted-foreground font-medium backdrop-blur-sm">
                                    <BarChart2 size={14} className="text-primary/70" />
                                    <span>{bootcamp.level}</span>
                                </div>
                            )}
                            {bootcamp.startDate && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/40 bg-card-bg/20 text-xs text-muted-foreground font-medium backdrop-blur-sm">
                                    <Calendar size={14} className="text-primary/70" />
                                    <span>{formatDateString(bootcamp.startDate)}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/40 bg-card-bg/20 text-xs text-muted-foreground font-medium backdrop-blur-sm">
                                <Users size={14} className="text-primary/70" />
                                <span>{rankingData.length} {rankingData.length === 1 ? 'alumno' : 'alumnos'}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-card-bg/50 hover:bg-card-bg transition-all hover:text-primary active:scale-95"
                    >
                        {copied ? (
                            <>
                                <Check size={14} className="text-green-500" />
                                <span className="text-green-500">¡Copiado!</span>
                            </>
                        ) : (
                            <>
                                <Share2 size={14} />
                                <span>Copiar enlace</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Section 1: Chart (Frecuencia) */}
                <div className="bg-card-bg/30 border border-border/40 p-6 rounded-2xl shadow-xl backdrop-blur-md relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                    
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Activity size={18} className="text-primary" />
                                <span>Frecuencia de lecturas</span>
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Histórico de lecciones vistas en el bootcamp desde el inicio hasta hoy
                            </p>
                        </div>
                    </div>

                    {/* Chart Canvas */}
                    <div className="relative w-full">
                        <svg 
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                            className="w-full h-auto aspect-[500/120] overflow-visible"
                        >
                            <defs>
                                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#06b6d4" />
                                    <stop offset="50%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#eab308" />
                                </linearGradient>
                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                            </defs>

                            {/* Horizontal Grid Lines */}
                            {chartGridLines.map((line, idx) => (
                                <g key={idx}>
                                    <line 
                                        x1={svgPadding.left} 
                                        y1={line.y} 
                                        x2={svgWidth - svgPadding.right} 
                                        y2={line.y} 
                                        stroke="rgba(255,255,255,0.06)" 
                                        strokeWidth="1"
                                    />
                                    <text 
                                        x={svgPadding.left - 5} 
                                        y={line.y + 3} 
                                        fill="rgba(255,255,255,0.35)" 
                                        fontSize="8" 
                                        textAnchor="end"
                                        className="font-mono text-[5px]"
                                    >
                                        {line.value}
                                    </text>
                                </g>
                            ))}

                            {/* Gradient Area under line */}
                            {chartAreaD && (
                                <path 
                                    d={chartAreaD} 
                                    fill="url(#areaGrad)" 
                                    className="pointer-events-none"
                                />
                            )}

                            {/* Curved Trend Line */}
                            {chartLineD && (
                                <path 
                                    d={chartLineD} 
                                    fill="none" 
                                    stroke="url(#lineGrad)" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round"
                                    className="pointer-events-none drop-shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
                                />
                            )}

                            {/* X Axis Labels */}
                            {chartPoints.map((pt, idx) => {
                                const step = Math.max(1, Math.ceil(chartPoints.length / 8));
                                const isLast = idx === chartPoints.length - 1;
                                const isFirst = idx === 0;
                                const isStep = idx % step === 0;
                                const showLabel = isFirst || (isStep && (chartPoints.length - 1 - idx) >= step / 2) || isLast;
                                
                                if (!showLabel) return null;
                                
                                return (
                                    <text 
                                        key={idx}
                                        x={pt.x}
                                        y={svgHeight - 4}
                                        fill="rgba(255,255,255,0.35)"
                                        fontSize="8"
                                        textAnchor="middle"
                                        className="font-semibold text-[5px]"
                                    >
                                        {pt.label}
                                    </text>
                                );
                            })}

                            {/* Interactive Dotted Line and Glowing Points on Hover */}
                            {hoveredPointIndex !== null && chartPoints[hoveredPointIndex] && (
                                <g>
                                    <line 
                                        x1={chartPoints[hoveredPointIndex].x} 
                                        y1={svgPadding.top} 
                                        x2={chartPoints[hoveredPointIndex].x} 
                                        y2={svgHeight - svgPadding.bottom} 
                                        stroke="rgba(16,185,129,0.35)" 
                                        strokeWidth="1" 
                                        strokeDasharray="3,3" 
                                        className="pointer-events-none"
                                    />
                                    <circle 
                                        cx={chartPoints[hoveredPointIndex].x} 
                                        cy={chartPoints[hoveredPointIndex].y} 
                                        r="6" 
                                        fill="#10b981" 
                                        fillOpacity="0.25"
                                        className="pointer-events-none animate-ping"
                                    />
                                    <circle 
                                        cx={chartPoints[hoveredPointIndex].x} 
                                        cy={chartPoints[hoveredPointIndex].y} 
                                        r="3" 
                                        fill="#ffffff" 
                                        stroke="#10b981"
                                        strokeWidth="1.5"
                                        className="pointer-events-none"
                                    />
                                </g>
                            )}

                            {/* Hover Interaction Areas */}
                            {chartPoints.map((pt, idx) => {
                                const xStart = idx === 0 
                                    ? svgPadding.left 
                                    : pt.x - (pt.x - chartPoints[idx - 1].x) / 2;
                                const xEnd = idx === chartPoints.length - 1 
                                    ? svgWidth - svgPadding.right 
                                    : pt.x + (chartPoints[idx + 1].x - pt.x) / 2;
                                const rectWidth = xEnd - xStart;

                                return (
                                    <rect
                                        key={idx}
                                        x={xStart}
                                        y={svgPadding.top}
                                        width={rectWidth}
                                        height={chartHeight}
                                        fill="transparent"
                                        className="cursor-pointer"
                                        onMouseEnter={() => setHoveredPointIndex(idx)}
                                        onMouseLeave={() => setHoveredPointIndex(null)}
                                    />
                                );
                            })}
                        </svg>

                        {/* Floating Tooltip */}
                        {hoveredPointIndex !== null && chartPoints[hoveredPointIndex] && (
                            <div 
                                className="absolute bg-background/95 backdrop-blur-md border border-border/80 px-3 py-2 rounded-lg shadow-xl pointer-events-none z-30 flex flex-col text-[11px] transition-all duration-150 animate-in fade-in zoom-in-95"
                                style={{
                                    left: `${(chartPoints[hoveredPointIndex].x / svgWidth) * 100}%`,
                                    top: `${(chartPoints[hoveredPointIndex].y / svgHeight) * 100 - 15}%`,
                                    transform: 'translate(-50%, -100%)'
                                }}
                            >
                                <span className="font-semibold text-foreground">{chartPoints[hoveredPointIndex].label}</span>
                                <span className="text-primary font-bold mt-0.5">
                                    {chartPoints[hoveredPointIndex].value} {chartPoints[hoveredPointIndex].value === 1 ? 'lectura' : 'lecturas'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 2: Leaderboard (Tabla de Posiciones) */}
                <div className="bg-card-bg/30 border border-border/40 p-6 rounded-2xl shadow-xl backdrop-blur-md relative overflow-hidden">
                    <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />

                    <div className="flex justify-between items-center mb-6 border-b border-border/30 pb-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Trophy size={18} className="text-primary" />
                                <span>Tabla de posiciones</span>
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Progreso y rendimiento de los alumnos inscritos
                            </p>
                        </div>
                        <span className="text-xs text-muted-foreground bg-secondary/30 px-3 py-1.5 rounded-full border border-border/40 font-medium">
                            Total alumnos: {rankingData.length}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {rankingData.map((item, index) => {
                            const { student, points } = item;
                            const totalLessonsList = modules.flatMap(m => m.lessons || []).filter(l => l.type !== 'subtitle');
                            const totalWeight = totalLessonsList.reduce((acc, l) => {
                                let weight = 1;
                                if (l.type === 'check') {
                                    try {
                                        const parsed = JSON.parse(l.content || '{}');
                                        weight = Number(parsed.value) || 1;
                                    } catch {}
                                }
                                return acc + weight;
                            }, 0);
                            const progressPercentage = totalWeight > 0 ? Math.round((points / totalWeight) * 100) : 0;
                            const isOnline = Object.values(onlineUsers).some(
                                (u: any) => u.email && student.email && u.email.trim().toLowerCase() === student.email.trim().toLowerCase()
                            );
                            const name = student.email ? student.email.split('@')[0] : 'Alumno';
                            const initials = student.email ? student.email.slice(0, 2).toUpperCase() : 'U';

                            const isTop3 = index < 3;
                            const podiumStyles = [
                                { bg: 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50 shadow-yellow-500/5', label: '🥇 1er Lugar' },
                                { bg: 'bg-slate-400/10 border-slate-400/30 hover:border-slate-400/50 shadow-slate-400/5', label: '🥈 2do Lugar' },
                                { bg: 'bg-amber-700/10 border-amber-700/30 hover:border-amber-700/50 shadow-amber-700/5', label: '🥉 3er Lugar' }
                            ];

                            const currentPodium = isTop3 ? podiumStyles[index] : null;

                            return (
                                <div 
                                    key={student.id} 
                                    className={`flex flex-row items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                                        currentPodium 
                                            ? `${currentPodium.bg} shadow-md` 
                                            : 'bg-card-bg/40 border-border hover:border-foreground/20'
                                    }`}
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        {/* Posición / Rank index */}
                                        <div className="flex items-center justify-center w-8 shrink-0 hidden sm:flex">
                                            {isTop3 ? (
                                                <span className="text-xl font-bold select-none">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                                            ) : (
                                                <span className="text-sm font-semibold text-muted select-none">#{index + 1}</span>
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <div className="relative shrink-0 hidden sm:block">
                                            <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm shadow-inner transition-colors ${
                                                index === 0 
                                                    ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' 
                                                    : index === 1 
                                                        ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30' 
                                                        : index === 2 
                                                            ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' 
                                                            : 'bg-primary/10 text-primary border border-primary/20'
                                            }`}>
                                                {initials}
                                            </div>
                                            <span 
                                                className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 transition-colors duration-300 ${
                                                    currentPodium ? 'border-card-bg' : 'border-card'
                                                } ${
                                                    isOnline ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-neutral-600'
                                                }`}
                                                title={isOnline ? 'Activo ahora' : 'Desconectado'}
                                            />
                                        </div>

                                        {/* Nombre y correo */}
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-foreground truncate capitalize">
                                                    {name}
                                                </span>
                                                {currentPodium && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/60 border border-border/40 uppercase tracking-wider scale-90">
                                                        {currentPodium.label}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground truncate">
                                                {student.email}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Puntos y Progreso */}
                                    <div className="flex items-center gap-6 shrink-0">
                                        {/* Progreso bar & fraction */}
                                        <div className="flex flex-col items-end text-right">
                                            <span className="text-xs text-muted-foreground font-medium mb-1">
                                                {points} de {totalWeight} <span className="hidden sm:inline">puntos</span>
                                            </span>
                                            <div className="hidden sm:block w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden border border-border/20">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ${
                                                        index === 0 
                                                            ? 'bg-yellow-500' 
                                                            : index === 1 
                                                                ? 'bg-slate-300' 
                                                                : index === 2 
                                                                    ? 'bg-amber-600' 
                                                                    : 'bg-primary'
                                                    }`}
                                                    style={{ width: `${progressPercentage}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Puntos de Clasificación Badge */}
                                        <div className={`h-12 w-20 rounded-xl flex flex-col items-center justify-center border font-bold select-none ${
                                            index === 0 
                                                ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500' 
                                                : index === 1 
                                                    ? 'bg-slate-400/20 border-slate-400/40 text-slate-300' 
                                                    : index === 2 
                                                        ? 'bg-amber-700/20 border-amber-700/40 text-amber-500' 
                                                        : 'bg-secondary/40 border-border text-foreground'
                                        }`}>
                                            <span className="text-lg leading-none">{progressPercentage}%</span>
                                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">avance</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* Footer */}
            <footer className="mt-20 border-t border-border/40 py-8 relative z-10 w-full bg-background/30 backdrop-blur-md">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
                    <div className="flex items-center gap-3">
                        {/* Logotipo */}
                        <div className="relative h-6 w-36 shrink-0">
                            <Image 
                                src="/brand/logotipo-synaptia-vertical-dark.png" 
                                alt="Synaptia Logotipo" 
                                fill 
                                className="object-contain object-left"
                            />
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                        © {new Date().getFullYear()} Synaptia. Todos los derechos reservados.
                    </div>
                </div>
            </footer>
        </div>
    );
}
