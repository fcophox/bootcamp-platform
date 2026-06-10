'use client';

import { useState } from 'react';
import { useOnlineUsers } from '@/contexts/OnlineUsersContext';
import { Trophy, Activity, Share2, Check } from 'lucide-react';

interface Student {
    id: number;
    email: string;
    status: string;
    joinedAt?: string;
}

interface Module {
    id: number;
    title: string;
    lessons?: {
        id: number;
        title: string;
    }[];
}

interface PublicRankingClientProps {
    bootcamp: {
        id: number;
        title: string;
        startDate?: string;
    };
    modules: Module[];
    students: Student[];
    initialCompletions: { studentId: number; lessonId: number; completedAt: string }[];
}

export function PublicRankingClient({
    bootcamp,
    modules,
    students,
    initialCompletions,
}: PublicRankingClientProps) {
    const { onlineUsers } = useOnlineUsers();
    const [copied, setCopied] = useState(false);
    const [showOnlyOnline, setShowOnlyOnline] = useState(false);
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

    // Process completions to build ranking data
    const rankingData = (() => {
        const totalLessons = modules.flatMap(m => m.lessons || []);
        const totalLessonsCount = totalLessons.length;

        const data = students.map(student => {
            const studentCompletions = initialCompletions.filter(c => c.studentId === student.id);
            // Unique completions to avoid double points for same lesson
            const uniqueCompletedLessons = Array.from(new Set(studentCompletions.map(c => c.lessonId)));
            
            return {
                student,
                points: uniqueCompletedLessons.length,
                completedLessonIds: uniqueCompletedLessons,
            };
        });

        // Sort by points descending, then by email alphabetically
        return data.sort((a, b) => b.points - a.points || a.student.email.localeCompare(b.student.email));
    })();

    // Process completions list for activity chart
    const completionsList = initialCompletions;

    // Process chart data (day mode by default, since week toggle was removed)
    const chartData = (() => {
        if (completionsList.length === 0) {
            return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(label => ({ label, value: 0 }));
        }

        const daysOfWeekLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const dayMapping = [6, 0, 1, 2, 3, 4, 5]; // Sunday=0 -> idx 6, Monday=1 -> idx 0, etc.
        const dayCounts = Array(7).fill(0);
        
        completionsList.forEach(c => {
            if (c.completedAt) {
                const date = new Date(c.completedAt);
                if (!isNaN(date.getTime())) {
                    const dayIndex = dayMapping[date.getDay()];
                    dayCounts[dayIndex]++;
                }
            }
        });

        return daysOfWeekLabels.map((label, idx) => ({
            label,
            value: dayCounts[idx]
        }));
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
        <div className="min-h-screen bg-background text-foreground py-10 px-4 md:px-8">
            <div className="max-w-4xl mx-auto flex flex-col gap-8">
                
                {/* Public Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                                Ranking Público
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                            {bootcamp.title}
                        </h1>
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
                                <span>Compartir Ranking</span>
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
                                <span>Frecuencia de Lecturas</span>
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Distribución de lecciones vistas en el bootcamp por día de la semana
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
                            {chartPoints.map((pt, idx) => (
                                <text 
                                    key={idx}
                                    x={pt.x}
                                    y={svgHeight - 4}
                                    fill="rgba(255,255,255,0.35)"
                                    fontSize="8"
                                    textAnchor="middle"
                                    className="font-semibold text-[5px]"
                                >
                                    {pt.label.slice(0, 3)}
                                </text>
                            ))}

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

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border/30 pb-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Trophy size={18} className="text-primary" />
                                <span>Tabla de Posiciones</span>
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Progreso y rendimiento de los alumnos inscritos
                            </p>
                        </div>
                        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start">
                            <span className="text-xs text-muted-foreground bg-secondary/30 px-3 py-1.5 rounded-full border border-border/40 font-medium">
                                {showOnlyOnline ? 'Conectados' : 'Total alumnos'}: {
                                    showOnlyOnline 
                                        ? rankingData.filter(item => Object.values(onlineUsers).some((u: any) => u.email && item.student.email && u.email.trim().toLowerCase() === item.student.email.trim().toLowerCase())).length
                                        : rankingData.length
                                }
                            </span>
                            <button
                                onClick={() => setShowOnlyOnline(!showOnlyOnline)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-300 flex items-center gap-2 ${
                                    showOnlyOnline 
                                        ? 'bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20 shadow-md shadow-green-500/5' 
                                        : 'bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${showOnlyOnline ? 'bg-green-500 animate-pulse' : 'bg-neutral-500'}`} />
                                <span>{showOnlyOnline ? 'Ver Todo' : 'Ver Online'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {(() => {
                            const displayedData = showOnlyOnline
                                ? rankingData.filter(item => {
                                    const { student } = item;
                                    return Object.values(onlineUsers).some(
                                        (u: any) => u.email && student.email && u.email.trim().toLowerCase() === student.email.trim().toLowerCase()
                                    );
                                })
                                : rankingData;

                            if (displayedData.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center p-8 bg-card-bg/25 border border-border/50 rounded-xl">
                                        <p className="text-sm text-muted-foreground">No hay alumnos conectados en este momento</p>
                                    </div>
                                );
                            }

                            return displayedData.map((item, index) => {
                                const { student, points } = item;
                                const totalLessons = modules.flatMap(m => m.lessons || []).length;
                                const progressPercentage = totalLessons > 0 ? Math.round((points / totalLessons) * 100) : 0;
                                const isOnline = Object.values(onlineUsers).some(
                                    (u: any) => u.email && student.email && u.email.trim().toLowerCase() === student.email.trim().toLowerCase()
                                );
                                const name = student.email ? student.email.split('@')[0] : 'Alumno';
                                const initials = student.email ? student.email.slice(0, 2).toUpperCase() : 'U';

                                const originalIndex = rankingData.findIndex(r => r.student.id === student.id);
                                const isTop3 = originalIndex < 3;
                                const podiumStyles = [
                                    { bg: 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50 shadow-yellow-500/5', label: '🥇 1er Lugar' },
                                    { bg: 'bg-slate-400/10 border-slate-400/30 hover:border-slate-400/50 shadow-slate-400/5', label: '🥈 2do Lugar' },
                                    { bg: 'bg-amber-700/10 border-amber-700/30 hover:border-amber-700/50 shadow-amber-700/5', label: '🥉 3er Lugar' }
                                ];

                                const currentPodium = isTop3 ? podiumStyles[originalIndex] : null;

                                return (
                                    <div 
                                        key={student.id} 
                                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                                            currentPodium 
                                                ? `${currentPodium.bg} shadow-md` 
                                                : 'bg-card-bg/40 border-border hover:border-foreground/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            {/* Posición / Rank index */}
                                            <div className="flex items-center justify-center w-8 shrink-0">
                                                {isTop3 ? (
                                                    <span className="text-xl font-bold select-none">{originalIndex === 0 ? '🥇' : originalIndex === 1 ? '🥈' : '🥉'}</span>
                                                ) : (
                                                    <span className="text-sm font-semibold text-muted select-none">#{originalIndex + 1}</span>
                                                )}
                                            </div>

                                            {/* Avatar */}
                                            <div className="relative shrink-0">
                                                <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner transition-colors ${
                                                    originalIndex === 0 
                                                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' 
                                                        : originalIndex === 1 
                                                            ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30' 
                                                            : originalIndex === 2 
                                                                ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' 
                                                                : 'bg-primary/10 text-primary border border-primary/20'
                                                }`}>
                                                    {initials}
                                                </div>
                                                <span 
                                                    className={`absolute -bottom-1 -right-1 block h-3 w-3 rounded-full border-2 transition-colors duration-300 ${
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
                                        <div className="flex items-center gap-6 mt-4 sm:mt-0 shrink-0 pl-12 sm:pl-0">
                                            {/* Progreso bar & fraction */}
                                            <div className="flex flex-col items-end text-right">
                                                <span className="text-xs text-muted-foreground font-medium mb-1">
                                                    {points} de {totalLessons} lecciones
                                                </span>
                                                <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden border border-border/20">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-1000 ${
                                                            originalIndex === 0 
                                                                ? 'bg-yellow-500' 
                                                                : originalIndex === 1 
                                                                    ? 'bg-slate-300' 
                                                                    : originalIndex === 2 
                                                                        ? 'bg-amber-600' 
                                                                        : 'bg-primary'
                                                        }`}
                                                        style={{ width: `${progressPercentage}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Puntos de Clasificación Badge */}
                                            <div className={`h-12 w-20 rounded-xl flex flex-col items-center justify-center border font-bold select-none ${
                                                originalIndex === 0 
                                                    ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500' 
                                                    : originalIndex === 1 
                                                        ? 'bg-slate-400/20 border-slate-400/40 text-slate-300' 
                                                        : originalIndex === 2 
                                                            ? 'bg-amber-700/20 border-amber-700/40 text-amber-500' 
                                                            : 'bg-secondary/40 border-border text-foreground'
                                            }`}>
                                                <span className="text-lg leading-none">{points}</span>
                                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">pts</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

            </div>
        </div>
    );
}
