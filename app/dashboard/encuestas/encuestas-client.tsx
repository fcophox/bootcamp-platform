'use client';

import { useState, useTransition } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import {
    ClipboardCheck, ChevronRight, Check, Loader2, X,
    ThumbsUp, ThumbsDown, MessageSquare, List,
    GraduationCap, Code, Database, Layout, Globe, Server,
    Cloud, Cpu, Smartphone, Bot, BrainCircuit, Sparkles, Network,
    Terminal, Microscope, Rocket, Binary, Menu, ArrowLeft, Send
} from 'lucide-react';
import { enviarRespuestasEncuesta } from '@/app/actions/medicion';
import type { EncuestaBootcamp, MedicionPregunta, TipoPregunta } from '@/app/actions/medicion';
import { useRouter } from 'next/navigation';

// ── Icon/Color maps (igual que en el resto del proyecto) ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
    code: Code, database: Database, layout: Layout, globe: Globe, server: Server,
    cloud: Cloud, cpu: Cpu, smartphone: Smartphone, bot: Bot, brain: BrainCircuit,
    sparkles: Sparkles, network: Network, terminal: Terminal, microscope: Microscope,
    rocket: Rocket, binary: Binary,
};
const COLOR_MAP: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', violet: 'bg-violet-500',
    orange: 'bg-orange-500', red: 'bg-red-500', pink: 'bg-pink-500',
};

// ── Widgets de respuesta por tipo ─────────────────────────────────────────────

function LikertWidget({ max, value, onChange }: { max: number; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex gap-2 flex-wrap">
            {Array.from({ length: max }, (_, i) => i + 1).map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(String(n))}
                    className={`w-11 h-11 rounded-xl border-2 text-sm font-bold transition-all ${
                        value === String(n)
                            ? 'border-primary bg-primary text-white shadow-lg shadow-primary/25 scale-110'
                            : 'border-border bg-card-bg text-muted hover:border-primary/50 hover:text-foreground'
                    }`}
                >
                    {n}
                </button>
            ))}
        </div>
    );
}

function CarasWidget({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const caras = [
        { val: 'contenta', emoji: '😊', label: 'Contenta' },
        { val: 'seria', emoji: '😐', label: 'Seria' },
        { val: 'confundida', emoji: '😕', label: 'Confundida' },
    ];
    return (
        <div className="flex gap-4">
            {caras.map(c => (
                <button
                    key={c.val}
                    type="button"
                    onClick={() => onChange(c.val)}
                    className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl border-2 transition-all ${
                        value === c.val
                            ? 'border-primary bg-primary/10 scale-110 shadow-lg shadow-primary/20'
                            : 'border-border bg-card-bg hover:border-primary/40'
                    }`}
                >
                    <span className="text-3xl">{c.emoji}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${value === c.val ? 'text-primary' : 'text-muted'}`}>{c.label}</span>
                </button>
            ))}
        </div>
    );
}

function NpsWidget({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => i).map(n => {
                    const color = n <= 6 ? 'hover:border-red-400' : n <= 8 ? 'hover:border-amber-400' : 'hover:border-green-400';
                    const activeColor = n <= 6 ? 'border-red-500 bg-red-500' : n <= 8 ? 'border-amber-500 bg-amber-500' : 'border-green-500 bg-green-500';
                    return (
                        <button
                            key={n}
                            type="button"
                            onClick={() => onChange(String(n))}
                            className={`w-10 h-10 rounded-xl border-2 text-sm font-bold transition-all ${
                                value === String(n)
                                    ? `${activeColor} text-white shadow-lg scale-110`
                                    : `border-border bg-card-bg text-muted ${color}`
                            }`}
                        >
                            {n}
                        </button>
                    );
                })}
            </div>
            <div className="flex justify-between text-[10px] text-muted font-medium px-1">
                <span>Nada probable</span>
                <span>Muy probable</span>
            </div>
        </div>
    );
}

function LikeDislikeWidget({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex gap-4">
            <button
                type="button"
                onClick={() => onChange('like')}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                    value === 'like'
                        ? 'border-green-500 bg-green-500/15 text-green-500 scale-105 shadow-lg shadow-green-500/20'
                        : 'border-border bg-card-bg text-muted hover:border-green-400 hover:text-green-500'
                }`}
            >
                <ThumbsUp size={20} fill={value === 'like' ? 'currentColor' : 'none'} /> Like
            </button>
            <button
                type="button"
                onClick={() => onChange('dislike')}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                    value === 'dislike'
                        ? 'border-red-500 bg-red-500/15 text-red-500 scale-105 shadow-lg shadow-red-500/20'
                        : 'border-border bg-card-bg text-muted hover:border-red-400 hover:text-red-500'
                }`}
            >
                <ThumbsDown size={20} fill={value === 'dislike' ? 'currentColor' : 'none'} /> Dislike
            </button>
        </div>
    );
}

function ComentarioWidget({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={4}
            placeholder="Escribe tu respuesta aquí..."
            className="w-full px-4 py-3 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 transition-colors"
        />
    );
}

function AlternativasWidget({ opciones, value, onChange }: { opciones: string[]; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-col gap-2">
            {opciones.map((op, idx) => (
                <button
                    key={idx}
                    type="button"
                    onClick={() => onChange(op)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                        value === op
                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-border bg-card-bg text-foreground hover:border-primary/40'
                    }`}
                >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${value === op ? 'border-primary' : 'border-border'}`}>
                        {value === op && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    {op}
                </button>
            ))}
        </div>
    );
}

function PreguntaWidget({ pregunta, value, onChange }: { pregunta: MedicionPregunta; value: string; onChange: (v: string) => void }) {
    switch (pregunta.tipo) {
        case 'likert_5': return <LikertWidget max={5} value={value} onChange={onChange} />;
        case 'escala_3': return <LikertWidget max={3} value={value} onChange={onChange} />;
        case 'escala_7': return <LikertWidget max={7} value={value} onChange={onChange} />;
        case 'caras': return <CarasWidget value={value} onChange={onChange} />;
        case 'nps': return <NpsWidget value={value} onChange={onChange} />;
        case 'like_dislike': return <LikeDislikeWidget value={value} onChange={onChange} />;
        case 'comentario': return <ComentarioWidget value={value} onChange={onChange} />;
        case 'alternativas': return <AlternativasWidget opciones={pregunta.opciones ?? []} value={value} onChange={onChange} />;
        default: return null;
    }
}

// ── Vista detalle de una encuesta ─────────────────────────────────────────────
function EncuestaDetalle({
    encuesta,
    onBack,
    onEnviado,
}: {
    encuesta: EncuestaBootcamp;
    onBack: () => void;
    onEnviado: () => void;
}) {
    const [respuestas, setRespuestas] = useState<Record<string, string>>(
        { ...encuesta.respuestas }
    );
    const [isSending, startSend] = useTransition();
    const [enviado, setEnviado] = useState(encuesta.respondidas === encuesta.totalPreguntas);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const router = useRouter();

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleChange = (preguntaId: string, valor: string) => {
        setRespuestas(prev => ({ ...prev, [preguntaId]: valor }));
    };

    const totalRespondidas = encuesta.preguntas.filter(p => respuestas[p.id] !== undefined && respuestas[p.id] !== '').length;
    const allAnswered = totalRespondidas === encuesta.preguntas.length;

    const handleEnviar = () => {
        startSend(async () => {
            try {
                const items = Object.entries(respuestas)
                    .filter(([, v]) => v !== '')
                    .map(([preguntaId, valor]) => ({ preguntaId, valor }));
                await enviarRespuestasEncuesta(items);
                setEnviado(true);
                showToast('¡Encuesta enviada correctamente!');
                setTimeout(() => { onEnviado(); router.refresh(); }, 1500);
            } catch (e: any) {
                showToast(e.message, 'error');
            }
        });
    };

    const IconComponent = encuesta.icon ? ICON_MAP[encuesta.icon] || GraduationCap : GraduationCap;
    const bgClass = encuesta.color ? COLOR_MAP[encuesta.color] || 'bg-primary' : 'bg-primary';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Back + header del bootcamp */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl border border-border bg-card-bg hover:bg-hover-bg transition-colors text-muted hover:text-foreground"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className={`w-10 h-10 rounded-full ${bgClass} flex items-center justify-center text-white shrink-0 shadow-lg`}>
                    <IconComponent size={20} />
                </div>
                <div>
                    <h2 className="text-base font-bold text-foreground">{encuesta.title}</h2>
                    <p className="text-xs text-muted">{encuesta.totalPreguntas} {encuesta.totalPreguntas === 1 ? 'pregunta' : 'preguntas'}</p>
                </div>

                {/* Progress pill */}
                <div className="ml-auto flex items-center gap-2">
                    <div className="text-xs font-bold text-muted">{totalRespondidas}/{encuesta.totalPreguntas}</div>
                    <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${encuesta.totalPreguntas > 0 ? (totalRespondidas / encuesta.totalPreguntas) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Banner ya respondida */}
            {enviado && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500">
                    <Check size={18} />
                    <p className="text-sm font-semibold">Ya respondiste esta encuesta. ¡Gracias por tu feedback!</p>
                </div>
            )}

            {/* Preguntas */}
            <div className="space-y-4">
                {encuesta.preguntas.map((p, idx) => {
                    const respondida = respuestas[p.id] !== undefined && respuestas[p.id] !== '';
                    return (
                        <div
                            key={p.id}
                            className={`bg-card-bg border rounded-2xl overflow-hidden transition-all ${respondida ? 'border-primary/30' : 'border-border'}`}
                        >
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-background/30">
                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${respondida ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                                    {respondida ? <Check size={12} /> : idx + 1}
                                </div>
                                <span className="text-sm font-semibold text-foreground flex-1">{p.texto}</span>
                            </div>
                            <div className="p-5">
                                <PreguntaWidget
                                    pregunta={p}
                                    value={respuestas[p.id] ?? ''}
                                    onChange={v => handleChange(p.id, v)}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Botón enviar */}
            {!enviado && (
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleEnviar}
                        disabled={isSending || !allAnswered}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {allAnswered ? 'Enviar respuestas' : `Faltan ${encuesta.totalPreguntas - totalRespondidas} respuesta${encuesta.totalPreguntas - totalRespondidas !== 1 ? 's' : ''}`}
                    </button>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl text-sm font-semibold ${
                    toast.type === 'success' ? 'bg-emerald-500 border-white/20 text-white shadow-emerald-500/20' : 'bg-red-500 border-white/20 text-white shadow-red-500/20'
                }`}>
                    {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function EncuestasClient({ encuestas }: { encuestas: EncuestaBootcamp[] }) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const [selected, setSelected] = useState<EncuestaBootcamp | null>(null);

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header fijo */}
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background/80 backdrop-blur-md transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileOpen(true)}
                            className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground"
                        >
                            <Menu size={20} />
                        </button>
                        {selected && (
                            <button
                                onClick={() => setSelected(null)}
                                className="p-1.5 rounded-lg text-muted hover:text-foreground transition-colors md:hidden"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <ClipboardCheck size={18} className="text-primary" />
                        <h2 className="text-sm font-light text-foreground">
                            {selected ? selected.title : 'Encuestas'}
                        </h2>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-10">
                    <div className="max-w-3xl mx-auto">

                        {selected ? (
                            <EncuestaDetalle
                                encuesta={selected}
                                onBack={() => setSelected(null)}
                                onEnviado={() => setSelected(null)}
                            />
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="mb-8">
                                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Encuestas</h1>
                                    <p className="text-sm text-muted font-light mt-1">Responde las encuestas de tus bootcamps y comparte tu experiencia.</p>
                                </div>

                                {encuestas.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                                        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                                            <ClipboardCheck size={30} className="text-primary opacity-60" />
                                        </div>
                                        <h3 className="text-base font-semibold text-foreground mb-2">Sin encuestas por ahora</h3>
                                        <p className="text-sm text-muted max-w-xs leading-relaxed">
                                            Cuando tu instructor publique una encuesta, aparecerá aquí para que puedas responderla.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {encuestas.map(enc => {
                                            const respondida = enc.respondidas === enc.totalPreguntas;
                                            const IconComponent = enc.icon ? ICON_MAP[enc.icon] || GraduationCap : GraduationCap;
                                            const bgClass = enc.color ? COLOR_MAP[enc.color] || 'bg-primary' : 'bg-primary';
                                            const pct = enc.totalPreguntas > 0 ? Math.round((enc.respondidas / enc.totalPreguntas) * 100) : 0;

                                            return (
                                                <button
                                                    key={enc.id}
                                                    onClick={() => setSelected(enc)}
                                                    className="w-full text-left bg-card-bg border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        {/* Icono */}
                                                        <div className={`w-12 h-12 rounded-full ${bgClass} flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                                                            <IconComponent size={22} />
                                                        </div>

                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h3 className="text-sm font-bold text-foreground truncate">{enc.title}</h3>
                                                                {respondida ? (
                                                                    <span className="flex items-center gap-1 text-[10px] font-black text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full shrink-0">
                                                                        <Check size={9} /> Completada
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
                                                                        Pendiente
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted mb-2">
                                                                {enc.totalPreguntas} {enc.totalPreguntas === 1 ? 'pregunta' : 'preguntas'}
                                                                {enc.respondidas > 0 && !respondida && ` · ${enc.respondidas} respondida${enc.respondidas !== 1 ? 's' : ''}`}
                                                            </p>
                                                            {/* Barra de progreso */}
                                                            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${respondida ? 'bg-green-500' : 'bg-primary'}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <ChevronRight size={16} className="text-muted group-hover:text-foreground transition-colors shrink-0" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
