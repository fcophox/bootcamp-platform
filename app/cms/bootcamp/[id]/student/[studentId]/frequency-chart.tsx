'use client';

import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';

interface Completion {
    lessonId: number;
    completedAt: string;
}

interface StudentFrequencyChartProps {
    completions: Completion[];
    startDate: string | null | undefined;
}

export function StudentFrequencyChart({ completions, startDate }: StudentFrequencyChartProps) {
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

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

        let start = parseStartDate(startDate);
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
        completions.forEach(c => {
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
                value: counts[key] || 0,
                fullDate: current.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
            });
            current.setDate(current.getDate() + 1);
        }

        return data;
    })();

    // Compute SVG constants for line chart
    const svgWidth = 600;
    const svgHeight = 150;
    const svgPadding = { top: 20, right: 20, bottom: 25, left: 35 };
    const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
    const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
    const maxChartValue = Math.max(...chartData.map(d => d.value), 4);

    const chartPoints = chartData.map((d, index) => {
        const x = svgPadding.left + (index / (chartData.length - 1 || 1)) * chartWidth;
        const y = svgPadding.top + chartHeight - (d.value / maxChartValue) * chartHeight;
        return { x, y, label: d.label, value: d.value, fullDate: d.fullDate };
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

    return (
        <div className="bg-card-bg border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="space-y-1">
                    <h3 className="text-md font-semibold text-foreground flex items-center gap-3">
                        <div className="text-primary rounded-xl">
                            <BarChart3 size={18} />
                        </div>
                        Frecuencia de lecturas
                    </h3>
                    <p className="text-xs text-muted">Histórico de lecciones vistas en el bootcamp desde el inicio hasta hoy</p>
                </div>
            </div>

            {/* Line Chart Canvas */}
            <div className="relative w-full">
                <svg 
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                    className="w-full h-auto aspect-[600/150] overflow-visible"
                >
                    <defs>
                        <linearGradient id="studentLineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="50%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#eab308" />
                        </linearGradient>
                        <linearGradient id="studentAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                        </linearGradient>
                        <filter id="studentLineShadow" x="-5%" y="-5%" width="110%" height="110%">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.2" />
                        </filter>
                    </defs>

                    {/* Grid lines */}
                    {chartGridLines.map((line, idx) => (
                        <g key={idx} className="opacity-60">
                            <line 
                                x1={svgPadding.left} 
                                y1={line.y} 
                                x2={svgWidth - svgPadding.right} 
                                y2={line.y} 
                                stroke="rgba(255,255,255,0.06)" 
                                strokeWidth="1"
                            />
                            <text 
                                x={svgPadding.left - 8} 
                                y={line.y + 3} 
                                fill="rgba(255,255,255,0.35)" 
                                fontSize="8" 
                                textAnchor="end"
                                className="font-mono text-[8px]"
                            >
                                {line.value}
                            </text>
                        </g>
                    ))}

                    {/* Chart Area and Line */}
                    {chartPoints.length > 0 && (
                        <>
                            <path d={chartAreaD} fill="url(#studentAreaGrad)" />
                            <path 
                                d={chartLineD} 
                                stroke="url(#studentLineGrad)" 
                                strokeWidth="2.5" 
                                fill="none" 
                                filter="url(#studentLineShadow)" 
                                strokeLinecap="round" 
                            />
                        </>
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
                                className="font-semibold text-[8px]"
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
                                y2={svgPadding.top + chartHeight} 
                                stroke="rgba(255,255,255,0.18)" 
                                strokeDasharray="3 3" 
                                strokeWidth="1.2"
                                className="pointer-events-none"
                            />
                            <circle 
                                cx={chartPoints[hoveredPointIndex].x} 
                                cy={chartPoints[hoveredPointIndex].y} 
                                r="6" 
                                fill="#10b981" 
                                opacity="0.35"
                                className="pointer-events-none"
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
                        className="absolute bg-background/90 border border-white/10 backdrop-blur-md px-3 py-2 rounded-xl shadow-2xl z-20 pointer-events-none text-left flex flex-col gap-1 transition-all duration-150"
                        style={{
                            left: `${(chartPoints[hoveredPointIndex].x / svgWidth) * 100}%`,
                            top: `${(chartPoints[hoveredPointIndex].y / svgHeight) * 100 - 35}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                            {chartPoints[hoveredPointIndex].fullDate}
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-sm font-bold text-foreground">
                                {chartPoints[hoveredPointIndex].value} {chartPoints[hoveredPointIndex].value === 1 ? 'lección' : 'lecciones'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
