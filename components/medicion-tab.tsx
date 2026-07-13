'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    Plus, Trash2, Send, BarChart3,
    ThumbsUp, ThumbsDown, Loader2, Check, ChevronDown, X, GripVertical, MessageSquare, List, Pause, Play, Users, User
} from 'lucide-react';
import {
    getMedicionPreguntas,
    createMedicionPregunta,
    updateMedicionPregunta,
    deleteMedicionPregunta,
    enviarMedicion,
    togglePausarPregunta,
    getResultadosEncuesta,
} from '@/app/actions/medicion';
import type { MedicionPregunta, TipoPregunta, RespuestaAlumno } from '@/app/actions/medicion';

// ── Tipos disponibles ──────────────────────────────────────────────────────────
const TIPOS: { value: TipoPregunta; label: string; description: string; preview: React.ReactNode }[] = [
    {
        value: 'likert_5',
        label: 'Escala Likert 1–5',
        description: 'Nivel de acuerdo del 1 al 5',
        preview: (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="w-7 h-7 rounded-lg border border-border bg-background/50 flex items-center justify-center text-xs font-bold text-muted">{n}</div>
                ))}
            </div>
        ),
    },
    {
        value: 'caras',
        label: 'Caritas',
        description: 'Contenta, seria o confundida',
        preview: (
            <div className="flex gap-2 text-xl">
                <span title="Contenta">😊</span>
                <span title="Seria">😐</span>
                <span title="Confundida">😕</span>
            </div>
        ),
    },
    {
        value: 'nps',
        label: 'NPS (0–10)',
        description: 'Net Promoter Score',
        preview: (
            <div className="flex gap-0.5 flex-wrap">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <div key={n} className="w-5 h-5 rounded border border-border bg-background/50 flex items-center justify-center text-[9px] font-bold text-muted">{n}</div>
                ))}
            </div>
        ),
    },
    {
        value: 'like_dislike',
        label: 'Like / Dislike',
        description: 'Pulgar arriba o abajo',
        preview: (
            <div className="flex gap-3">
                <div className="flex items-center gap-1 text-green-500 text-xs font-bold"><ThumbsUp size={14} /> Like</div>
                <div className="flex items-center gap-1 text-red-500 text-xs font-bold"><ThumbsDown size={14} /> Dislike</div>
            </div>
        ),
    },
    {
        value: 'escala_7',
        label: 'Escala 1–7',
        description: 'Valoración del 1 al 7',
        preview: (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                    <div key={n} className="w-6 h-6 rounded border border-border bg-background/50 flex items-center justify-center text-[10px] font-bold text-muted">{n}</div>
                ))}
            </div>
        ),
    },
    {
        value: 'escala_3',
        label: 'Escala 1–3',
        description: 'Valoración del 1 al 3',
        preview: (
            <div className="flex gap-1">
                {[1, 2, 3].map(n => (
                    <div key={n} className="w-8 h-8 rounded-lg border border-border bg-background/50 flex items-center justify-center text-sm font-bold text-muted">{n}</div>
                ))}
            </div>
        ),
    },
    {
        value: 'comentario',
        label: 'Comentario',
        description: 'Respuesta de texto libre',
        preview: (
            <div className="flex items-center gap-2 w-full">
                <MessageSquare size={13} className="text-muted shrink-0" />
                <div className="flex-1 h-6 rounded-lg border border-dashed border-border bg-background/50 px-2 flex items-center">
                    <span className="text-[10px] text-muted italic">Escribe tu respuesta...</span>
                </div>
            </div>
        ),
    },
    {
        value: 'alternativas',
        label: 'Alternativas',
        description: 'Selección única entre opciones',
        preview: (
            <div className="flex flex-col gap-1 w-full">
                {['Opción A', 'Opción B', 'Opción C'].map(o => (
                    <div key={o} className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-border bg-background/50 shrink-0" />
                        <span className="text-[10px] text-muted">{o}</span>
                    </div>
                ))}
            </div>
        ),
    },
];

const DEFAULT_OPCIONES = ['', '', ''];

function getTipoLabel(tipo: TipoPregunta) {
    return TIPOS.find(t => t.value === tipo)?.label ?? tipo;
}

// ── Selector de tipo (dropdown) ────────────────────────────────────────────────
function TipoSelector({ value, onChange }: { value: TipoPregunta; onChange: (v: TipoPregunta) => void }) {
    const [open, setOpen] = useState(false);
    const selected = TIPOS.find(t => t.value === value)!;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground hover:border-primary/40 transition-colors"
            >
                <span className="font-medium">{selected.label}</span>
                <ChevronDown size={14} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-card-bg border border-border rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                    {TIPOS.map(tipo => (
                        <button
                            key={tipo.value}
                            type="button"
                            onClick={() => { onChange(tipo.value); setOpen(false); }}
                            className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-hover-bg transition-colors border-b border-border/50 last:border-0 ${value === tipo.value ? 'bg-primary/5' : ''}`}
                        >
                            <div>
                                <p className={`text-sm font-semibold ${value === tipo.value ? 'text-primary' : 'text-foreground'}`}>{tipo.label}</p>
                                <p className="text-[11px] text-muted">{tipo.description}</p>
                            </div>
                            <div className="shrink-0">{tipo.preview}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Editor de alternativas ─────────────────────────────────────────────────────
function AlternativasEditor({
    opciones,
    onChange,
    disabled,
}: {
    opciones: string[];
    onChange: (opciones: string[]) => void;
    disabled?: boolean;
}) {
    const handleChange = (idx: number, val: string) => {
        const next = [...opciones];
        next[idx] = val;
        onChange(next);
    };

    const handleAdd = () => onChange([...opciones, '']);

    const handleRemove = (idx: number) => {
        if (opciones.length <= 2) return; // mínimo 2 opciones
        onChange(opciones.filter((_, i) => i !== idx));
    };

    return (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Alternativas</label>
            <div className="space-y-2">
                {opciones.map((op, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        {/* Radio decorativo */}
                        <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
                        <input
                            type="text"
                            value={op}
                            onChange={e => handleChange(idx, e.target.value)}
                            disabled={disabled}
                            placeholder={`Opción ${idx + 1}`}
                            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        {!disabled && opciones.length > 2 && (
                            <button
                                type="button"
                                onClick={() => handleRemove(idx)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            {!disabled && (
                <button
                    type="button"
                    onClick={handleAdd}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-1"
                >
                    <Plus size={13} /> Agregar alternativa
                </button>
            )}
        </div>
    );
}

// ── Preview de alternativas ────────────────────────────────────────────────────
function AlternativasPreview({ opciones }: { opciones: string[] }) {
    const [selected, setSelected] = useState<number | null>(null);
    return (
        <div className="flex flex-col gap-2 w-full">
            {opciones.map((op, idx) => (
                <button
                    key={idx}
                    type="button"
                    onClick={() => setSelected(idx)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm font-medium transition-all text-left ${
                        selected === idx
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background/50 text-muted hover:border-primary/40 hover:text-foreground'
                    }`}
                >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${selected === idx ? 'border-primary' : 'border-border'}`}>
                        {selected === idx && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    {op || <span className="italic opacity-40">Opción {idx + 1}</span>}
                </button>
            ))}
        </div>
    );
}

// ── Card de pregunta ───────────────────────────────────────────────────────────
function PreguntaCard({
    pregunta,
    index,
    onDelete,
    onUpdate,
    onTogglePausa,
    isSent,
}: {
    pregunta: MedicionPregunta;
    index: number;
    onDelete: (id: string) => void;
    onUpdate: (id: string, texto: string, tipo: TipoPregunta, opciones: string[] | null) => void;
    onTogglePausa: (id: string, pausada: boolean) => void;
    isSent: boolean;
}) {
    const [texto, setTexto] = useState(pregunta.texto);
    const [tipo, setTipo] = useState<TipoPregunta>(pregunta.tipo);
    const [opciones, setOpciones] = useState<string[]>(pregunta.opciones ?? DEFAULT_OPCIONES);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, startSave] = useTransition();
    const [isActioning, startAction] = useTransition();

    const handleTexto = (v: string) => { setTexto(v); setIsDirty(true); };
    const handleTipo = (v: TipoPregunta) => {
        setTipo(v);
        if (v === 'alternativas' && (!opciones || opciones.length === 0)) {
            setOpciones([...DEFAULT_OPCIONES]);
        }
        setIsDirty(true);
    };
    const handleOpciones = (v: string[]) => { setOpciones(v); setIsDirty(true); };

    const handleSave = () => {
        startSave(async () => {
            await onUpdate(pregunta.id, texto, tipo, tipo === 'alternativas' ? opciones : null);
            setIsDirty(false);
        });
    };

    const tipoDef = TIPOS.find(t => t.value === tipo)!;
    const isPausada = pregunta.pausada;

    return (
        <div className={`bg-card-bg border rounded-2xl overflow-hidden shadow-sm transition-all ${
            isPausada ? 'border-border opacity-60' : isSent ? 'border-green-500/20' : 'border-border hover:border-primary/30'
        }`}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 bg-background/30">
                <div className="cursor-grab text-muted hover:text-foreground transition-colors">
                    <GripVertical size={16} />
                </div>
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {index + 1}
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider flex-1">{getTipoLabel(tipo)}</span>

                {/* Badges de estado */}
                {isPausada && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <Pause size={9} /> Pausada
                    </span>
                )}
                {isSent && !isPausada && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                        <Check size={9} /> Activa
                    </span>
                )}

                {/* Acciones — siempre visibles */}
                <div className="flex items-center gap-1">
                    {/* Pausar / Reactivar (solo para enviadas) */}
                    {isSent && (
                        <button
                            onClick={() => startAction(async () => onTogglePausa(pregunta.id, !isPausada))}
                            disabled={isActioning}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                isPausada
                                    ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20'
                                    : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20'
                            }`}
                            title={isPausada ? 'Reactivar' : 'Pausar'}
                        >
                            {isActioning
                                ? <Loader2 size={11} className="animate-spin" />
                                : isPausada ? <Play size={11} /> : <Pause size={11} />
                            }
                            {isPausada ? 'Reactivar' : 'Pausar'}
                        </button>
                    )}
                    {/* Eliminar — siempre disponible */}
                    <button
                        onClick={() => onDelete(pregunta.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                        title="Eliminar pregunta"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
                {/* Texto */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Pregunta</label>
                    <textarea
                        value={texto}
                        onChange={e => handleTexto(e.target.value)}
                        disabled={isSent}
                        rows={2}
                        placeholder="Escribe aquí la pregunta para el alumno..."
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                </div>

                {/* Tipo */}
                {!isSent && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Tipo de respuesta</label>
                        <TipoSelector value={tipo} onChange={handleTipo} />
                    </div>
                )}

                {/* Editor de alternativas */}
                {tipo === 'alternativas' && (
                    <AlternativasEditor
                        opciones={opciones}
                        onChange={handleOpciones}
                        disabled={isSent}
                    />
                )}

                {/* Preview */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Vista previa del alumno</label>
                    <div className="px-4 py-3 rounded-xl border border-dashed border-border bg-background/30">
                        {tipo === 'alternativas'
                            ? <AlternativasPreview opciones={opciones} />
                            : <div className="flex items-center">{tipoDef.preview}</div>
                        }
                    </div>
                </div>

                {/* Save btn */}
                {!isSent && isDirty && (
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !texto.trim() || (tipo === 'alternativas' && opciones.filter(o => o.trim()).length < 2)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Guardar cambios
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Formato legible de valores por tipo ───────────────────────────────────────
function formatValor(tipo: TipoPregunta, valor: string): string {
    switch (tipo) {
        case 'like_dislike': return valor === 'like' ? '👍 Like' : '👎 Dislike';
        case 'caras':
            return valor === 'contenta' ? '😊 Contenta' : valor === 'seria' ? '😐 Seria' : '😕 Confundida';
        case 'nps': return `${valor} / 10`;
        case 'likert_5': return `${valor} / 5`;
        case 'escala_7': return `${valor} / 7`;
        case 'escala_3': return `${valor} / 3`;
        default: return valor;
    }
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

// ── Drawer de resultados ───────────────────────────────────────────────────────
function ResultadosDrawer({
    open,
    onClose,
    bootcampId,
}: {
    open: boolean;
    onClose: () => void;
    bootcampId: number;
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<{ totalRespuestas: number; alumnos: RespuestaAlumno[] } | null>(null);

    useEffect(() => {
        if (!open) return;
        setIsLoading(true);
        getResultadosEncuesta(bootcampId)
            .then(d => setData(d))
            .finally(() => setIsLoading(false));
    }, [open, bootcampId]);

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <div className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[520px] bg-card-bg border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-background/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Users size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">Resultados</h3>
                            <p className="text-xs text-muted">
                                {data ? `${data.totalRespuestas} ${data.totalRespuestas === 1 ? 'alumno respondió' : 'alumnos respondieron'}` : 'Cargando...'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-hover-bg transition-colors text-muted hover:text-foreground">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-full gap-3">
                            <Loader2 size={28} className="animate-spin text-primary" />
                            <p className="text-sm text-muted">Cargando resultados...</p>
                        </div>
                    )}

                    {!isLoading && data?.totalRespuestas === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Users size={26} className="text-primary opacity-50" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground mb-1">Sin respuestas aún</p>
                                <p className="text-xs text-muted leading-relaxed">Los alumnos aún no han respondido esta encuesta.</p>
                            </div>
                        </div>
                    )}

                    {!isLoading && data && data.alumnos.length > 0 && (
                        <div className="p-5 space-y-4">
                            {data.alumnos.map((alumno, idx) => (
                                <div key={alumno.userId} className="bg-background/50 border border-border/60 rounded-2xl overflow-hidden">
                                    {/* Alumno header */}
                                    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 bg-card-bg">
                                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 font-bold text-sm">
                                            {alumno.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{alumno.email}</p>
                                            <p className="text-[10px] text-muted">{alumno.respuestas.length} {alumno.respuestas.length === 1 ? 'respuesta' : 'respuestas'}</p>
                                        </div>
                                        <span className="ml-auto text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full shrink-0">
                                            #{idx + 1}
                                        </span>
                                    </div>

                                    {/* Respuestas */}
                                    <div className="divide-y divide-border/40">
                                        {alumno.respuestas.map(r => (
                                            <div key={r.preguntaId} className="px-4 py-3 flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-2 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-muted mb-1 leading-snug">{r.preguntaTexto}</p>
                                                    <p className={`text-sm font-bold ${colorValor(r.tipo, r.valor)}`}>
                                                        {formatValor(r.tipo, r.valor)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function MedicionTab({ bootcampId }: { bootcampId: number }) {
    const [preguntas, setPreguntas] = useState<MedicionPregunta[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, startAdd] = useTransition();
    const [isSending, startSend] = useTransition();
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showResultados, setShowResultados] = useState(false);

    const [newTexto, setNewTexto] = useState('');
    const [newTipo, setNewTipo] = useState<TipoPregunta>('likert_5');
    const [newOpciones, setNewOpciones] = useState<string[]>([...DEFAULT_OPCIONES]);
    const [showForm, setShowForm] = useState(false);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        getMedicionPreguntas(bootcampId).then(data => {
            setPreguntas(data);
            setIsLoading(false);
        });
    }, [bootcampId]);

    const handleAdd = () => {
        if (!newTexto.trim()) return;
        if (newTipo === 'alternativas' && newOpciones.filter(o => o.trim()).length < 2) return;
        startAdd(async () => {
            try {
                const nueva = await createMedicionPregunta({
                    bootcampId,
                    texto: newTexto.trim(),
                    tipo: newTipo,
                    orden: preguntas.length,
                    opciones: newTipo === 'alternativas' ? newOpciones : null,
                });
                setPreguntas(prev => [...prev, nueva]);
                setNewTexto('');
                setNewTipo('likert_5');
                setNewOpciones([...DEFAULT_OPCIONES]);
                setShowForm(false);
                showToast('Pregunta creada correctamente.');
            } catch (e: any) {
                showToast(e.message, 'error');
            }
        });
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteMedicionPregunta(id, bootcampId);
            setPreguntas(prev => prev.filter(p => p.id !== id));
            showToast('Pregunta eliminada.');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleTogglePausa = async (id: string, pausada: boolean) => {
        try {
            await togglePausarPregunta(id, pausada);
            setPreguntas(prev => prev.map(p => p.id === id ? { ...p, pausada } : p));
            showToast(pausada ? 'Pregunta pausada. Los alumnos no la verán.' : 'Pregunta reactivada.');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleUpdate = async (id: string, texto: string, tipo: TipoPregunta, opciones: string[] | null) => {
        try {
            await updateMedicionPregunta({ id, texto, tipo, opciones });
            setPreguntas(prev => prev.map(p => p.id === id ? { ...p, texto, tipo, opciones } : p));
            showToast('Pregunta actualizada.');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleEnviar = () => {
        startSend(async () => {
            try {
                await enviarMedicion(bootcampId);
                setPreguntas(prev => prev.map(p => ({ ...p, enviada: true })));
                showToast('¡Medición enviada a los alumnos!');
            } catch (e: any) {
                showToast(e.message, 'error');
            }
        });
    };

    const pendientes = preguntas.filter(p => !p.enviada);
    const enviadas = preguntas.filter(p => p.enviada && !p.pausada);
    const pausadas = preguntas.filter(p => p.enviada && p.pausada);
    const canSend = pendientes.length > 0;
    const hasEnviadas = enviadas.length > 0 || pausadas.length > 0;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-primary mb-3" />
                <p className="text-sm text-muted">Cargando medición...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-base font-bold text-foreground">Medición de satisfacción</h2>
                    <p className="text-xs text-muted mt-0.5">Crea preguntas y envíalas a los alumnos del bootcamp.</p>
                </div>
                <div className="flex items-center gap-2">
                    {hasEnviadas && (
                        <button
                            onClick={() => setShowResultados(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card-bg text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                        >
                            <Users size={14} />
                            Ver resultados
                        </button>
                    )}
                    {canSend && (
                        <button
                            onClick={handleEnviar}
                            disabled={isSending}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-60"
                        >
                            {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Enviar a alumnos
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card-bg text-sm font-semibold text-foreground hover:border-primary/40 transition-colors"
                    >
                        {showForm ? <X size={14} /> : <Plus size={14} />}
                        {showForm ? 'Cancelar' : 'Nueva pregunta'}
                    </button>
                </div>
            </div>

            {/* Formulario nueva pregunta */}
            {showForm && (
                <div className="bg-card-bg border border-primary/30 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-lg shadow-primary/5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Plus size={14} className="text-primary" /> Nueva pregunta
                    </h3>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Texto de la pregunta</label>
                        <textarea
                            value={newTexto}
                            onChange={e => setNewTexto(e.target.value)}
                            rows={2}
                            placeholder="Ej: ¿Qué tan satisfecho estás con el contenido del bootcamp?"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Tipo de respuesta</label>
                        <TipoSelector
                            value={newTipo}
                            onChange={v => {
                                setNewTipo(v);
                                if (v === 'alternativas') setNewOpciones([...DEFAULT_OPCIONES]);
                            }}
                        />
                    </div>

                    {/* Editor de alternativas en formulario */}
                    {newTipo === 'alternativas' && (
                        <AlternativasEditor opciones={newOpciones} onChange={setNewOpciones} />
                    )}

                    {/* Preview */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Vista previa</label>
                        <div className="px-4 py-3 rounded-xl border border-dashed border-border bg-background/30">
                            {newTipo === 'alternativas'
                                ? <AlternativasPreview opciones={newOpciones} />
                                : <div className="flex items-center">{TIPOS.find(t => t.value === newTipo)?.preview}</div>
                            }
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleAdd}
                            disabled={isAdding || !newTexto.trim() || (newTipo === 'alternativas' && newOpciones.filter(o => o.trim()).length < 2)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Agregar pregunta
                        </button>
                    </div>
                </div>
            )}

            {/* Estado vacío */}
            {preguntas.length === 0 && !showForm && (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                        <BarChart3 size={30} className="text-primary opacity-60" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Sin preguntas aún</h3>
                    <p className="text-sm text-muted max-w-xs leading-relaxed mb-6">
                        Crea preguntas de medición para conocer la satisfacción de tus alumnos con este bootcamp.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    >
                        <Plus size={14} /> Crear primera pregunta
                    </button>
                </div>
            )}

            {/* Preguntas pendientes */}
            {pendientes.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-primary rounded-full"></div>
                        <h3 className="text-sm font-bold text-foreground">Preguntas ({pendientes.length})</h3>
                        <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Pendientes de envío</span>
                    </div>
                    {pendientes.map((p, i) => (
                        <PreguntaCard
                            key={p.id}
                            pregunta={p}
                            index={i}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                            onTogglePausa={handleTogglePausa}
                            isSent={false}
                        />
                    ))}
                </div>
            )}

            {/* Preguntas enviadas activas */}
            {enviadas.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-green-500 rounded-full"></div>
                        <h3 className="text-sm font-bold text-foreground">Activas ({enviadas.length})</h3>
                        <span className="text-[10px] font-black text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Visibles para alumnos</span>
                    </div>
                    {enviadas.map((p, i) => (
                        <PreguntaCard
                            key={p.id}
                            pregunta={p}
                            index={i}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                            onTogglePausa={handleTogglePausa}
                            isSent={true}
                        />
                    ))}
                </div>
            )}

            {/* Preguntas pausadas */}
            {pausadas.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
                        <h3 className="text-sm font-bold text-foreground">Pausadas ({pausadas.length})</h3>
                        <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Ocultas para alumnos</span>
                    </div>
                    {pausadas.map((p, i) => (
                        <PreguntaCard
                            key={p.id}
                            pregunta={p}
                            index={i}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                            onTogglePausa={handleTogglePausa}
                            isSent={true}
                        />
                    ))}
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl text-sm font-semibold ${
                    toast.type === 'success'
                        ? 'bg-emerald-500 border-white/20 text-white shadow-emerald-500/20'
                        : 'bg-red-500 border-white/20 text-white shadow-red-500/20'
                }`}>
                    {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Drawer de resultados */}
            <ResultadosDrawer
                open={showResultados}
                onClose={() => setShowResultados(false)}
                bootcampId={bootcampId}
            />
        </div>
    );
}
