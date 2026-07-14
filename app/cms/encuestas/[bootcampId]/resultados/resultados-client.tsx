'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { ArrowLeft, BarChart3, Users, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import type { RespuestaAlumno, TipoPregunta } from '@/app/actions/medicion';

interface Props {
    bootcamp: { id: number; title: string };
    resultados: { totalRespuestas: number; alumnos: RespuestaAlumno[] };
}

function colorValor(tipo: TipoPregunta, valor: string): string {
    if (tipo === 'like_dislike') return valor === 'like' ? 'text-green-500' : 'text-red-500';
    if (tipo === 'caras') return valor === 'contenta' ? 'text-green-500' : valor === 'seria' ? 'text-amber-500' : 'text-red-500';
    if (tipo === 'nps') {
        const n = Number(valor);
        return n >= 9 ? 'text-green-500' : n >= 7 ? 'text-amber-500' : 'text-red-500';
    }
    return 'text-foreground';
}

function formatValor(tipo: TipoPregunta, valor: string): string {
    if (tipo === 'like_dislike') return valor === 'like' ? '👍 Like' : '👎 Dislike';
    if (tipo === 'caras') {
        const map: Record<string, string> = { contenta: '😊 Contenta', seria: '😐 Seria', confundida: '😕 Confundida' };
        return map[valor] ?? valor;
    }
    return valor;
}

function formatTipoLabel(tipo: TipoPregunta): string {
    const map: Record<TipoPregunta, string> = {
        likert_5: 'Escala Likert 1–5', caras: 'Caritas', nps: 'NPS 0–10',
        like_dislike: 'Like / Dislike', escala_7: 'Escala 1–7', escala_3: 'Escala 1–3',
        comentario: 'Comentario', alternativas: 'Alternativas',
    };
    return map[tipo] ?? tipo;
}

function PreguntaResultados({
    preguntaTexto,
    tipo,
    respuestas,
}: {
    preguntaTexto: string;
    tipo: TipoPregunta;
    respuestas: { email: string; valor: string }[];
}) {
    const [idx, setIdx] = useState(0);
    const total = respuestas.length;
    const actual = respuestas[idx];

    return (
        <div className="bg-card-bg border border-border/60 rounded-2xl overflow-hidden">
            {/* Cabecera */}
            <div className="px-6 py-5 border-b border-border/50 bg-background/30 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">{formatTipoLabel(tipo)}</p>
                    <p className="text-sm font-semibold text-foreground leading-snug">{preguntaTexto}</p>
                </div>
                <span className="shrink-0 text-[11px] font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mt-0.5">
                    {total} {total === 1 ? 'respuesta' : 'respuestas'}
                </span>
            </div>

            {/* Carrusel */}
            {total === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted">Sin respuestas aún</div>
            ) : (
                <div className="px-6 py-5 flex items-center gap-4">
                    <button
                        onClick={() => setIdx(i => Math.max(0, i - 1))}
                        disabled={idx === 0}
                        className="p-2 rounded-xl border border-border bg-background text-muted hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-30 shrink-0"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <div className="flex-1 text-center space-y-2">
                        <p className="text-xs text-muted truncate">{actual.email}</p>
                        <p className={`text-2xl font-bold ${colorValor(tipo, actual.valor)}`}>
                            {formatValor(tipo, actual.valor)}
                        </p>
                        <p className="text-xs text-muted">{idx + 1} / {total}</p>
                    </div>

                    <button
                        onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
                        disabled={idx === total - 1}
                        className="p-2 rounded-xl border border-border bg-background text-muted hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-30 shrink-0"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}

export function ResultadosEncuestaClient({ bootcamp, resultados }: Props) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();

    // Agrupar respuestas por pregunta
    const porPregunta: Record<string, { texto: string; tipo: TipoPregunta; respuestas: { email: string; valor: string }[] }> = {};
    for (const alumno of resultados.alumnos) {
        for (const r of alumno.respuestas) {
            if (!porPregunta[r.preguntaId]) {
                porPregunta[r.preguntaId] = { texto: r.preguntaTexto, tipo: r.tipo, respuestas: [] };
            }
            porPregunta[r.preguntaId].respuestas.push({ email: alumno.email, valor: r.valor });
        }
    }
    const preguntas = Object.entries(porPregunta);

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background border-b border-border transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full">
                        <div className="flex items-center h-full gap-2">
                            <button
                                onClick={() => setIsMobileOpen(true)}
                                className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground"
                            >
                                <Menu size={20} />
                            </button>
                            <Link href="/cms/encuestas" className="p-1.5 rounded-lg text-muted hover:text-foreground transition-colors">
                                <ArrowLeft size={16} />
                            </Link>
                            <Link href="/cms/encuestas" className="text-xs text-muted hover:text-foreground transition-colors">
                                Encuestas
                            </Link>
                            <span className="text-muted text-xs">/</span>
                            <Link href="/cms/encuestas/crear" className="text-xs text-muted hover:text-foreground transition-colors">
                                {bootcamp.title}
                            </Link>
                            <span className="text-muted text-xs">/</span>
                            <span className="text-xs text-foreground font-medium">Resultados</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-3xl mx-auto">

                        {/* Título */}
                        <div className="flex items-start justify-between gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Resultados</h1>
                                <p className="text-sm text-muted font-light mt-1">{bootcamp.title}</p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                                <Users size={15} className="text-primary" />
                                <span className="text-sm font-bold text-primary">
                                    {resultados.totalRespuestas} {resultados.totalRespuestas === 1 ? 'alumno respondió' : 'alumnos respondieron'}
                                </span>
                            </div>
                        </div>

                        {/* Sin respuestas */}
                        {resultados.totalRespuestas === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                    <BarChart3 size={26} className="text-primary opacity-50" />
                                </div>
                                <p className="text-sm font-semibold text-foreground mb-1">Sin respuestas aún</p>
                                <p className="text-xs text-muted leading-relaxed max-w-xs">
                                    Los alumnos aún no han respondido esta encuesta.
                                </p>
                            </div>
                        )}

                        {/* Preguntas con carrusel */}
                        {preguntas.length > 0 && (
                            <div className="space-y-4">
                                {preguntas.map(([preguntaId, { texto, tipo, respuestas }]) => (
                                    <PreguntaResultados
                                        key={preguntaId}
                                        preguntaTexto={texto}
                                        tipo={tipo}
                                        respuestas={respuestas}
                                    />
                                ))}
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
}
