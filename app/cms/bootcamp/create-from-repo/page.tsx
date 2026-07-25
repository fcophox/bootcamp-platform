'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { MobileMenuButton } from '@/components/mobile-menu-button';
import { Loader2, GitBranch, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { planImportFromRepo, applyImportPlan } from '@/app/actions/courseImport';
import type { PlanImportResult } from '@/app/actions/courseImport';

export default function CreateCourseFromRepoPage() {
    const router = useRouter();
    const { isCollapsed } = useSidebar();
    const [isPending, startTransition] = useTransition();
    const [step, setStep] = useState<'form' | 'preview'>('form');
    const [form, setForm] = useState({ repoUrl: '', path: '', ref: 'main', pat: '' });
    const [plan, setPlan] = useState<PlanImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePlan = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const result = await planImportFromRepo(form);
            if ('error' in result) {
                setError(result.error);
                return;
            }
            setPlan(result);
            setStep('preview');
        });
    };

    const handleApply = () => {
        if (!plan) return;
        setError(null);
        startTransition(async () => {
            const result = await applyImportPlan({
                course: plan.course,
                plan: plan.plan,
                connection: form,
            });
            if ('error' in result) {
                setError(result.error);
                return;
            }
            router.push(`/cms/bootcamp/${result.bootcampId}/manage`);
        });
    };

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            <main className={`flex-1 transition-all ${isCollapsed ? 'md:ml-16' : 'md:ml-64'} p-6 md:p-10`}>
                <div className="mx-auto max-w-2xl">
                    <div className="mb-8 flex items-center gap-3">
                        <MobileMenuButton />
                        <div>
                            <h1 className="text-2xl font-medium text-foreground">Agregar curso desde repositorio</h1>
                            <p className="mt-1 text-sm text-muted">
                                Conecta un repositorio de GitHub con la estructura de curso.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 'form' && (
                        <form onSubmit={handlePlan} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs font-medium text-foreground">Repositorio</label>
                                <input
                                    value={form.repoUrl}
                                    onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
                                    placeholder="owner/repo o https://github.com/owner/repo"
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium text-foreground">
                                    Ruta del curso (opcional si está en la raíz)
                                </label>
                                <input
                                    value={form.path}
                                    onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                                    placeholder="cursos/data-engineering"
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium text-foreground">Rama</label>
                                <input
                                    value={form.ref}
                                    onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))}
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium text-foreground">Token de acceso (PAT)</label>
                                <input
                                    type="password"
                                    value={form.pat}
                                    onChange={(e) => setForm((f) => ({ ...f, pat: e.target.value }))}
                                    placeholder="github_pat_..."
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    required
                                />
                                <p className="mt-1.5 text-xs text-muted">
                                    Usa un token &quot;fine-grained&quot;, limitado a este repositorio, con permiso de solo lectura de contenido (Contents: Read-only).
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isPending && <Loader2 size={16} className="animate-spin" />}
                                Analizar repositorio
                            </button>
                        </form>
                    )}

                    {step === 'preview' && plan && (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-border bg-card-bg p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                                    <GitBranch size={16} />
                                    {form.repoUrl} @ {form.ref}
                                </div>
                                <p className="mb-2 text-sm font-medium text-foreground">{plan.course.title}</p>
                                <ul className="space-y-1 text-sm text-muted">
                                    <li>{plan.summary.modulesToCreate} módulos nuevos</li>
                                    <li>{plan.summary.lessonsToCreate} lecciones nuevas</li>
                                    {plan.summary.lessonsToSkip > 0 && (
                                        <li>{plan.summary.lessonsToSkip} lecciones sin cambios</li>
                                    )}
                                </ul>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('form')}
                                    className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-hover-bg"
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={isPending}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-70"
                                >
                                    {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    Confirmar e importar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
