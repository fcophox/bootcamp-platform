'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import {
    Menu, Plus, Users, Send, Clock,
    GraduationCap, Code, Database, Layout, Globe, Server,
    Cloud, Cpu, Smartphone, Bot, BrainCircuit, Sparkles, Network,
    Terminal, Microscope, Rocket, Binary, BarChart3, Search,
    X, Loader2, AlertTriangle, CheckCircle, MoreHorizontal, Edit2, Trash2, UserCheck, Pause, Play
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EncuestaGestion, AlumnoBootcamp } from '@/app/actions/medicion';
import { enviarMedicion, retirarMedicion, eliminarEncuesta, getAlumnosBootcamp, pausarEncuesta, reactivarEncuesta } from '@/app/actions/medicion';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
    code: Code, database: Database, layout: Layout, globe: Globe, server: Server,
    cloud: Cloud, cpu: Cpu, smartphone: Smartphone, bot: Bot, brain: BrainCircuit,
    sparkles: Sparkles, network: Network, terminal: Terminal, microscope: Microscope,
    rocket: Rocket, binary: Binary,
};
const COLOR_MAP: Record<string, string> = {
    green: 'from-green-500 to-green-700',
    blue: 'from-blue-500 to-blue-700',
    violet: 'from-violet-500 to-violet-700',
    orange: 'from-orange-500 to-orange-700',
    red: 'from-red-500 to-red-700',
    pink: 'from-pink-500 to-pink-700',
};

// ── Modal eliminar ─────────────────────────────────────────────────────────────
function ModalEliminar({
    enc,
    onClose,
    onConfirm,
    isPending,
}: {
    enc: EncuestaGestion;
    onClose: () => void;
    onConfirm: () => void;
    isPending: boolean;
}) {
    return (
        <>
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-md bg-card-bg border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                                <Trash2 size={18} />
                            </div>
                            <h3 className="text-base font-bold text-foreground">Eliminar encuesta</h3>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                        <p className="text-sm text-foreground leading-relaxed">
                            ¿Estás seguro de eliminar la encuesta de{' '}
                            <span className="font-semibold">"{enc.bootcampTitle}"</span>?
                        </p>
                        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
                            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                            <p className="text-xs leading-relaxed">
                                Se eliminarán permanentemente todas las preguntas y las respuestas de los alumnos. Esta acción no se puede deshacer.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                        <button
                            onClick={onClose}
                            disabled={isPending}
                            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isPending}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                            {isPending
                                ? <><Loader2 size={14} className="animate-spin" /> Eliminando...</>
                                : <><Trash2 size={14} /> Eliminar encuesta</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

// ── Modal de confirmación envío ────────────────────────────────────────────────
function ModalEnvio({
    enc,
    onClose,
    onConfirm,
    isPending,
}: {
    enc: EncuestaGestion;
    onClose: () => void;
    onConfirm: (selectedEmails: string[]) => void;
    isPending: boolean;
}) {
    const yaEnviada = enc.enviadas > 0;
    const [alumnos, setAlumnos] = useState<AlumnoBootcamp[]>([]);
    const [loadingAlumnos, setLoadingAlumnos] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        getAlumnosBootcamp(enc.bootcampId).then(data => {
            setAlumnos(data);
            setSelected(new Set(data.map(a => a.email)));
            setLoadingAlumnos(false);
        });
    }, [enc.bootcampId]);

    const toggleAll = () => {
        if (selected.size === alumnos.length) setSelected(new Set());
        else setSelected(new Set(alumnos.map(a => a.email)));
    };

    const toggle = (email: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(email) ? next.delete(email) : next.add(email);
            return next;
        });
    };

    return (
        <>
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-md bg-card-bg border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
                        <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${yaEnviada ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                                {yaEnviada ? <AlertTriangle size={18} /> : <Send size={18} />}
                            </div>
                            <h3 className="text-base font-bold text-foreground">
                                {yaEnviada ? 'Reenviar encuesta' : 'Enviar encuesta'}
                            </h3>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                        <p className="text-sm text-foreground leading-relaxed">
                            Selecciona los alumnos de{' '}
                            <span className="font-semibold">"{enc.bootcampTitle}"</span>{' '}
                            que recibirán la encuesta.
                        </p>

                        {yaEnviada && (
                            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                <p className="text-xs leading-relaxed">
                                    Esta encuesta ya fue enviada. Al reenviar se retirará y publicará nuevamente.
                                </p>
                            </div>
                        )}

                        {/* Lista de alumnos */}
                        {loadingAlumnos ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-muted">
                                <Loader2 size={16} className="animate-spin" />
                                <span className="text-sm">Cargando alumnos...</span>
                            </div>
                        ) : alumnos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Users size={24} className="text-muted mb-2" />
                                <p className="text-sm text-muted">No hay alumnos activos en este bootcamp.</p>
                            </div>
                        ) : (
                            <div className="border border-border rounded-xl overflow-hidden">
                                {/* Seleccionar todos */}
                                <button
                                    onClick={toggleAll}
                                    className="w-full flex items-center gap-3 px-4 py-3 bg-background/50 hover:bg-hover-bg transition-colors border-b border-border"
                                >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected.size === alumnos.length ? 'bg-primary border-primary' : 'border-border'}`}>
                                        {selected.size === alumnos.length && <CheckCircle size={10} className="text-white" />}
                                    </div>
                                    <span className="text-xs font-semibold text-muted">
                                        {selected.size === alumnos.length ? 'Deseleccionar todos' : 'Seleccionar todos'} ({alumnos.length})
                                    </span>
                                </button>
                                {/* Alumnos */}
                                {alumnos.map(alumno => (
                                    <button
                                        key={alumno.email}
                                        onClick={() => toggle(alumno.email)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-hover-bg transition-colors border-b border-border last:border-0"
                                    >
                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected.has(alumno.email) ? 'bg-primary border-primary' : 'border-border'}`}>
                                            {selected.has(alumno.email) && <CheckCircle size={10} className="text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-sm font-medium text-foreground truncate">{alumno.nombre}</p>
                                            {alumno.nombre !== alumno.email && (
                                                <p className="text-xs text-muted truncate">{alumno.email}</p>
                                            )}
                                        </div>
                                        <UserCheck size={13} className={`shrink-0 transition-colors ${selected.has(alumno.email) ? 'text-primary' : 'text-muted/30'}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
                        <span className="text-xs text-muted">
                            {selected.size} de {alumnos.length} seleccionados
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                disabled={isPending}
                                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => onConfirm(Array.from(selected))}
                                disabled={isPending || selected.size === 0 || loadingAlumnos}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isPending
                                    ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                                    : <><Send size={14} /> {yaEnviada ? 'Reenviar' : 'Enviar'}</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function EncuestasGestionClient({ encuestas }: { encuestas: EncuestaGestion[] }) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [modalEnc, setModalEnc] = useState<EncuestaGestion | null>(null);
    const [modalEliminarEnc, setModalEliminarEnc] = useState<EncuestaGestion | null>(null);
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    // Cerrar menú al click fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-menu]')) setOpenMenuId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = encuestas.filter(enc =>
        enc.bootcampTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handlePausar = (enc: EncuestaGestion) => {
        startTransition(async () => {
            try {
                if (enc.pausada) {
                    await reactivarEncuesta(enc.bootcampId);
                    setToast(`Encuesta de "${enc.bootcampTitle}" reactivada`);
                } else {
                    await pausarEncuesta(enc.bootcampId);
                    setToast(`Encuesta de "${enc.bootcampTitle}" pausada`);
                }
                setTimeout(() => setToast(null), 4000);
                router.refresh();
            } catch (e: any) {
                setToast('Error: ' + e.message);
                setTimeout(() => setToast(null), 4000);
            }
        });
    };

    const handleEliminar = () => {
        if (!modalEliminarEnc) return;
        startTransition(async () => {
            try {
                await eliminarEncuesta(modalEliminarEnc.bootcampId);
                setToast(`Encuesta de "${modalEliminarEnc.bootcampTitle}" eliminada`);
                setModalEliminarEnc(null);
                setTimeout(() => setToast(null), 4000);
                router.refresh();
            } catch (e: any) {
                setToast('Error: ' + e.message);
                setModalEliminarEnc(null);
                setTimeout(() => setToast(null), 4000);
            }
        });
    };

    const handleConfirmarEnvio = (selectedEmails: string[]) => {
        if (!modalEnc) return;
        startTransition(async () => {
            try {
                if (modalEnc.enviadas > 0) {
                    await retirarMedicion(modalEnc.bootcampId);
                }
                await enviarMedicion(modalEnc.bootcampId);
                setToast(`Encuesta enviada a ${selectedEmails.length} alumno${selectedEmails.length !== 1 ? 's' : ''} de "${modalEnc.bootcampTitle}"`);
                setModalEnc(null);
                setTimeout(() => setToast(null), 4000);
                router.refresh();
            } catch (e: any) {
                setToast('Error: ' + e.message);
                setModalEnc(null);
                setTimeout(() => setToast(null), 4000);
            }
        });
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background border-b border-border transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full">
                        <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsMobileOpen(true)}
                                    className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground"
                                >
                                    <Menu size={20} />
                                </button>
                                <h2 className="text-sm font-light text-foreground">Encuestas</h2>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-6xl mx-auto">

                        {/* Título + botón */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl font-semibold text-foreground mb-2">Encuestas</h1>
                                <p className="text-muted">
                                    Administra y gestiona las encuestas asociadas a tus bootcamps.
                                </p>
                            </div>
                            <Link
                                href="/cms/encuestas/crear"
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                <Plus size={20} />
                                <span>Crear encuesta</span>
                            </Link>
                        </div>

                        {/* Search */}
                        <div className="mb-6 flex gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
                                <input
                                    type="text"
                                    placeholder="Buscar encuesta..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card-bg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Lista */}
                        {filtered.length > 0 ? (
                            <div className="flex flex-col border border-border rounded-xl overflow-visible">
                                {filtered.map((enc, i) => {
                                    const IconComponent = enc.bootcampIcon ? ICON_MAP[enc.bootcampIcon] || GraduationCap : GraduationCap;
                                    const gradient = enc.bootcampColor ? COLOR_MAP[enc.bootcampColor] || 'from-violet-500 to-violet-700' : 'from-violet-500 to-violet-700';
                                    const yaEnviada = enc.enviadas > 0;
                                    return (
                                        <div key={enc.bootcampId} className={`flex items-center gap-4 px-5 py-4 bg-card-bg hover:bg-hover-bg transition-colors ${i < filtered.length - 1 ? 'border-b border-border' : ''} ${i === 0 ? 'rounded-t-xl' : ''} ${i === filtered.length - 1 ? 'rounded-b-xl' : ''}`}>
                                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                                                <IconComponent size={18} className="text-white/70" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{enc.bootcampTitle}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-xs text-muted">{enc.totalPreguntas} {enc.totalPreguntas === 1 ? 'pregunta' : 'preguntas'}</span>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0 ${
                                                enc.pausada
                                                    ? 'bg-slate-500/10 text-slate-400'
                                                    : yaEnviada
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : 'bg-amber-500/10 text-amber-500'
                                            }`}>
                                                {enc.pausada ? 'Pausada' : yaEnviada ? 'Activa' : 'Borrador'}
                                            </span>
                                            {/* Menú 3 puntos */}
                                            <div className="relative shrink-0" data-menu>
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === enc.bootcampId ? null : enc.bootcampId)}
                                                    className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
                                                >
                                                    <MoreHorizontal size={16} />
                                                </button>
                                                {openMenuId === enc.bootcampId && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-card-bg border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in zoom-in-95 duration-150">
                                                        <Link
                                                            href={`/cms/encuestas/crear?bootcamp=${enc.bootcampId}`}
                                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors"
                                                            onClick={() => setOpenMenuId(null)}
                                                        >
                                                            <Edit2 size={14} /> Editar
                                                        </Link>
                                                        <Link
                                                            href={`/cms/encuestas/${enc.bootcampId}/resultados`}
                                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors"
                                                            onClick={() => setOpenMenuId(null)}
                                                        >
                                                            <Users size={14} /> Resultados
                                                        </Link>
                                                        <button
                                                            onClick={() => { setModalEnc(enc); setOpenMenuId(null); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors"
                                                        >
                                                            <Send size={14} /> {yaEnviada ? 'Reenviar' : 'Enviar'}
                                                        </button>
                                                        <button
                                                            onClick={() => { setOpenMenuId(null); handlePausar(enc); }}
                                                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${enc.pausada ? 'text-green-500 hover:bg-green-500/10' : 'text-amber-500 hover:bg-amber-500/10'}`}
                                                        >
                                                            {enc.pausada ? <Play size={14} /> : <Pause size={14} />}
                                                            {enc.pausada ? 'Reactivar' : 'Pausar'}
                                                        </button>
                                                        <div className="h-px bg-border my-1" />
                                                        <button
                                                            onClick={() => { setOpenMenuId(null); setModalEliminarEnc(enc); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                                        >
                                                            <Trash2 size={14} /> Eliminar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-28 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                                    <BarChart3 size={30} className="text-primary opacity-60" />
                                </div>
                                <h3 className="text-base font-semibold text-foreground mb-2">Sin encuestas aún</h3>
                                <p className="text-sm text-muted max-w-xs leading-relaxed mb-6">
                                    Crea tu primera encuesta y asígnala a un bootcamp para comenzar a recopilar feedback.
                                </p>
                                <Link
                                    href="/cms/encuestas/crear"
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                                >
                                    <Plus size={15} />
                                    Crear primera encuesta
                                </Link>
                            </div>
                        )}

                    </div>
                </main>
            </div>

            {/* Modal eliminar */}
            {modalEliminarEnc && (
                <ModalEliminar
                    enc={modalEliminarEnc}
                    onClose={() => setModalEliminarEnc(null)}
                    onConfirm={handleEliminar}
                    isPending={isPending}
                />
            )}

            {/* Modal envío */}
            {modalEnc && (
                <ModalEnvio
                    enc={modalEnc}
                    onClose={() => setModalEnc(null)}
                    onConfirm={handleConfirmarEnvio}
                    isPending={isPending}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-500 border border-white/20 text-white shadow-xl text-sm font-semibold">
                    <CheckCircle size={16} />
                    {toast}
                </div>
            )}
        </div>
    );
}
