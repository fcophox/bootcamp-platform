'use client';

import { useState, useTransition } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { ArrowLeft, ClipboardCheck, Menu, Check, AlertTriangle, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { MedicionTab } from '@/components/medicion-tab';
import { limpiarMedicionPreguntas } from '@/app/actions/medicion';

interface Bootcamp {
    id: number;
    title: string;
    icon: string | null;
    color: string | null;
    totalPreguntas: number; // cuántas preguntas ya tiene
}

export function CrearEncuestaClient({
    bootcamps,
    initialBootcampId,
}: {
    bootcamps: Bootcamp[];
    initialBootcampId: number | null;
}) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const [bootcampId, setBootcampId] = useState<number | ''>(initialBootcampId ?? '');
    const [confirmedBootcampId, setConfirmedBootcampId] = useState<number | ''>(initialBootcampId ?? '');
    const [pendingBootcampId, setPendingBootcampId] = useState<number | null>(null); // bootcamp esperando confirmación
    const [isPending, startTransition] = useTransition();

    const selectedBootcamp = bootcamps.find(b => b.id === confirmedBootcampId);

    const handleSelectBootcamp = (value: number | '') => {
        setBootcampId(value);
        if (!value) {
            setConfirmedBootcampId('');
            return;
        }
        const bc = bootcamps.find(b => b.id === value);
        if (bc && bc.totalPreguntas > 0) {
            // Tiene preguntas → pedir confirmación
            setPendingBootcampId(value);
        } else {
            // Sin preguntas → confirmar directo
            setConfirmedBootcampId(value);
        }
    };

    const handleConfirmarLimpieza = () => {
        if (!pendingBootcampId) return;
        startTransition(async () => {
            await limpiarMedicionPreguntas(pendingBootcampId);
            setConfirmedBootcampId(pendingBootcampId);
            setPendingBootcampId(null);
        });
    };

    const handleCancelarModal = () => {
        // Revertir selector al valor anterior
        setBootcampId(confirmedBootcampId);
        setPendingBootcampId(null);
    };

    const pendingBootcamp = bootcamps.find(b => b.id === pendingBootcampId);

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
                            <span className="text-xs text-foreground font-medium">Crear encuesta</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-3xl mx-auto space-y-8">

                        {/* Card: Crear encuesta */}
                        <div className="bg-card-bg border border-border rounded-2xl p-8">
                            <h2 className="text-lg font-semibold text-foreground mb-6">Crear encuesta</h2>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">
                                    Bootcamp asociado <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={bootcampId}
                                    onChange={e => handleSelectBootcamp(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="">Selecciona un bootcamp</option>
                                    {bootcamps.map(b => (
                                        <option key={b.id} value={b.id}>{b.title}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted">
                                    La encuesta se asociará al bootcamp seleccionado y sus alumnos podrán responderla.
                                </p>
                            </div>
                        </div>

                        {/* Sección de preguntas */}
                        {confirmedBootcampId !== '' && selectedBootcamp && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 pb-2 border-b border-border">
                                    <ClipboardCheck size={16} className="text-primary" />
                                    <h2 className="text-base font-semibold text-foreground">
                                        Preguntas — {selectedBootcamp.title}
                                    </h2>
                                </div>
                                <MedicionTab bootcampId={confirmedBootcampId} hideEnviar />
                            </div>
                        )}

                        {/* Placeholder */}
                        {bootcampId === '' && (
                            <div className="flex flex-col items-center justify-center py-20 text-center bg-card-bg border-2 border-dashed border-border rounded-3xl">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                    <ClipboardCheck size={24} className="text-primary opacity-60" />
                                </div>
                                <p className="text-sm font-semibold text-foreground mb-1">Selecciona un bootcamp</p>
                                <p className="text-xs text-muted max-w-xs leading-relaxed">
                                    Elige el bootcamp al que quieres asociar esta encuesta para comenzar a agregar preguntas.
                                </p>
                            </div>
                        )}

                    </div>
                </main>
            </div>

            {/* Modal de confirmación de limpieza */}
            {pendingBootcamp && (
                <>
                    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={handleCancelarModal} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <div className="pointer-events-auto w-full max-w-md bg-card-bg border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <h3 className="text-base font-bold text-foreground">Crear encuesta nueva</h3>
                                </div>
                                <button onClick={handleCancelarModal} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                <p className="text-sm text-foreground leading-relaxed">
                                    El bootcamp <span className="font-semibold">"{pendingBootcamp.title}"</span> ya tiene{' '}
                                    <span className="font-semibold">{pendingBootcamp.totalPreguntas} {pendingBootcamp.totalPreguntas === 1 ? 'pregunta' : 'preguntas'}</span> creadas.
                                </p>
                                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                    <p className="text-xs leading-relaxed">
                                        Al continuar, se eliminarán todas las preguntas existentes y comenzarás desde cero.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                                <button
                                    onClick={handleCancelarModal}
                                    disabled={isPending}
                                    className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmarLimpieza}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-500/90 transition-colors disabled:opacity-50"
                                >
                                    {isPending
                                        ? <><Loader2 size={14} className="animate-spin" /> Limpiando...</>
                                        : <><Check size={14} /> Sí, comenzar desde cero</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
