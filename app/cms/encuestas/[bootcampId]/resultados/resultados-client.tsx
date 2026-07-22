'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import {
    ArrowLeft, BarChart3, Users, ChevronLeft, ChevronRight,
    Menu, Download, FileSpreadsheet, FileText, X, Check, Search,
} from 'lucide-react';
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

function formatValorPlano(tipo: TipoPregunta, valor: string): string {
    if (tipo === 'like_dislike') return valor === 'like' ? 'Like' : 'Dislike';
    if (tipo === 'caras') {
        const map: Record<string, string> = { contenta: 'Contenta', seria: 'Seria', confundida: 'Confundida' };
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
            <div className="px-6 py-5 border-b border-border/50 bg-background/30 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">{formatTipoLabel(tipo)}</p>
                    <p className="text-sm font-semibold text-foreground leading-snug">{preguntaTexto}</p>
                </div>
                <span className="shrink-0 text-[11px] font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mt-0.5">
                    {total} {total === 1 ? 'respuesta' : 'respuestas'}
                </span>
            </div>

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

// ── Modal de selección de alumnos para exportar ────────────────────────────────
function ModalExportar({
    alumnos,
    onClose,
    onExportExcel,
    onExportPDF,
}: {
    alumnos: RespuestaAlumno[];
    onClose: () => void;
    onExportExcel: (seleccionados: string[]) => void;
    onExportPDF: (seleccionados: string[]) => void;
}) {
    const [seleccionados, setSeleccionados] = useState<Set<string>>(
        new Set(alumnos.map(a => a.userId))
    );
    const [busqueda, setBusqueda] = useState('');

    const alumnosFiltrados = useMemo(
        () => alumnos.filter(a => a.email.toLowerCase().includes(busqueda.toLowerCase())),
        [alumnos, busqueda]
    );

    const todosSeleccionados = alumnosFiltrados.every(a => seleccionados.has(a.userId));

    function toggleAlumno(userId: string) {
        setSeleccionados(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    }

    function toggleTodos() {
        if (todosSeleccionados) {
            setSeleccionados(prev => {
                const next = new Set(prev);
                alumnosFiltrados.forEach(a => next.delete(a.userId));
                return next;
            });
        } else {
            setSeleccionados(prev => {
                const next = new Set(prev);
                alumnosFiltrados.forEach(a => next.add(a.userId));
                return next;
            });
        }
    }

    const ids = Array.from(seleccionados);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">Exportar resultados</h2>
                        <p className="text-xs text-muted mt-0.5">Selecciona los alumnos a incluir en el informe</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Búsqueda */}
                <div className="px-6 pt-4 shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Buscar por correo..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-hover-bg border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                    </div>
                </div>

                {/* Toggle todos */}
                <div className="px-6 pt-3 pb-2 shrink-0">
                    <button
                        onClick={toggleTodos}
                        className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
                    >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${todosSeleccionados ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                            {todosSeleccionados && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        <span className="ml-auto text-muted">{seleccionados.size} / {alumnos.length}</span>
                    </button>
                </div>

                {/* Lista */}
                <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-1">
                    {alumnosFiltrados.length === 0 ? (
                        <p className="text-xs text-muted text-center py-6">Sin resultados para &ldquo;{busqueda}&rdquo;</p>
                    ) : (
                        alumnosFiltrados.map(alumno => (
                            <button
                                key={alumno.userId}
                                onClick={() => toggleAlumno(alumno.userId)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-hover-bg transition-colors text-left"
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${seleccionados.has(alumno.userId) ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                                    {seleccionados.has(alumno.userId) && <Check size={10} className="text-white" strokeWidth={3} />}
                                </div>
                                <span className="text-sm text-foreground truncate">{alumno.email}</span>
                                <span className="ml-auto text-[11px] text-muted shrink-0">{alumno.respuestas.length} resp.</span>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer: botones de exportar */}
                <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
                    <button
                        onClick={() => onExportExcel(ids)}
                        disabled={seleccionados.size === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
                    >
                        <FileSpreadsheet size={15} />
                        Excel
                    </button>
                    <button
                        onClick={() => onExportPDF(ids)}
                        disabled={seleccionados.size === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
                    >
                        <FileText size={15} />
                        PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function ResultadosEncuestaClient({ bootcamp, resultados }: Props) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const [modalAbierto, setModalAbierto] = useState(false);

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

    // ── Exportar Excel ──────────────────────────────────────────────────────────
    async function exportarExcel(userIdsSeleccionados: string[]) {
        const { utils, writeFile } = await import('xlsx');
        const selSet = new Set(userIdsSeleccionados);
        const alumnosFiltrados = resultados.alumnos.filter(a => selSet.has(a.userId));

        // Obtener lista ordenada de preguntas
        const preguntasList = preguntas.map(([id, { texto, tipo }]) => ({ id, texto, tipo }));

        // Cabecera: Correo + una columna por pregunta
        const headers = ['Correo', ...preguntasList.map(p => p.texto)];

        // Filas por alumno
        const rows = alumnosFiltrados.map(alumno => {
            const respMap: Record<string, string> = {};
            alumno.respuestas.forEach(r => { respMap[r.preguntaId] = r.valor; });
            return [
                alumno.email,
                ...preguntasList.map(p => formatValorPlano(p.tipo, respMap[p.id] ?? '—')),
            ];
        });

        const ws = utils.aoa_to_sheet([headers, ...rows]);

        // Estilo de ancho de columnas automático
        ws['!cols'] = headers.map((h, i) => ({
            wch: Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length), 12),
        }));

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Resultados');
        writeFile(wb, `resultados_${bootcamp.title.replace(/\s+/g, '_')}.xlsx`);
        setModalAbierto(false);
    }

    // ── Exportar PDF ────────────────────────────────────────────────────────────
    async function exportarPDF(userIdsSeleccionados: string[]) {
        const { jsPDF } = await import('jspdf');
        const selSet = new Set(userIdsSeleccionados);
        const alumnosFiltrados = resultados.alumnos.filter(a => selSet.has(a.userId));
        const preguntasList = preguntas.map(([id, { texto, tipo }]) => ({ id, texto, tipo }));

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 16;
        const contentW = pageW - margin * 2;
        let y = 20;

        // Título
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Resultados de Encuesta', margin, y);
        y += 8;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(bootcamp.title, margin, y);
        y += 5;
        doc.text(`${alumnosFiltrados.length} alumno${alumnosFiltrados.length !== 1 ? 's' : ''} incluido${alumnosFiltrados.length !== 1 ? 's' : ''}`, margin, y);
        y += 10;

        // Línea separadora
        doc.setDrawColor(220);
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        // Por cada pregunta: encabezado + respuestas
        for (const { id, texto, tipo } of preguntasList) {
            const respuestasAlumno = alumnosFiltrados.map(a => {
                const r = a.respuestas.find(r => r.preguntaId === id);
                return r ? { email: a.email, valor: r.valor } : null;
            }).filter(Boolean) as { email: string; valor: string }[];

            // Salto de página si queda poco espacio
            if (y > 260) {
                doc.addPage();
                y = 20;
            }

            // Tipo de pregunta
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(120);
            doc.text(formatTipoLabel(tipo).toUpperCase(), margin, y);
            y += 5;

            // Texto de pregunta
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30);
            const textoLines = doc.splitTextToSize(texto, contentW);
            doc.text(textoLines, margin, y);
            y += textoLines.length * 5 + 3;

            // Respuestas
            if (respuestasAlumno.length === 0) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(150);
                doc.text('Sin respuestas', margin + 4, y);
                y += 6;
            } else {
                for (const resp of respuestasAlumno) {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(80);
                    const emailTrunc = resp.email.length > 40 ? resp.email.slice(0, 40) + '…' : resp.email;
                    doc.text(emailTrunc, margin + 4, y);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(30);
                    doc.text(formatValorPlano(tipo, resp.valor), margin + 4 + 95, y);
                    y += 5.5;
                }
            }

            y += 5;
            // Línea separadora entre preguntas
            doc.setDrawColor(235);
            doc.line(margin, y, pageW - margin, y);
            y += 6;
        }

        // Pie de página
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(160);
            doc.text(
                `Generado el ${new Date().toLocaleDateString('es-CL')} — Página ${i} de ${totalPages}`,
                margin,
                doc.internal.pageSize.getHeight() - 8
            );
        }

        doc.save(`resultados_${bootcamp.title.replace(/\s+/g, '_')}.pdf`);
        setModalAbierto(false);
    }

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
                            <Link href={`/cms/encuestas/crear?bootcamp=${bootcamp.id}`} className="text-xs text-muted hover:text-foreground transition-colors">
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
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Badge de respuestas */}
                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
                                    <Users size={15} className="text-primary" />
                                    <span className="text-sm font-bold text-primary">
                                        {resultados.totalRespuestas} {resultados.totalRespuestas === 1 ? 'alumno respondió' : 'alumnos respondieron'}
                                    </span>
                                </div>
                                {/* Botón exportar */}
                                {resultados.totalRespuestas > 0 && (
                                    <button
                                        onClick={() => setModalAbierto(true)}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-hover-bg border border-border text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                                    >
                                        <Download size={15} />
                                        Exportar
                                    </button>
                                )}
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

            {/* Modal exportar */}
            {modalAbierto && (
                <ModalExportar
                    alumnos={resultados.alumnos}
                    onClose={() => setModalAbierto(false)}
                    onExportExcel={exportarExcel}
                    onExportPDF={exportarPDF}
                />
            )}
        </div>
    );
}
