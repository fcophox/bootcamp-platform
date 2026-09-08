'use client';

import { useState, useTransition, Component, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { MobileMenuButton } from '@/components/mobile-menu-button';
import { Loader2, GitBranch, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { planImportFromRepo, applyImportPlan, createTemplateInRepo } from '@/app/actions/courseImport';
import type { EmptySourceResult } from '@/app/actions/courseImport';
import type { PlanImportResult } from '@/lib/courseImport/types';

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    const err: unknown = this.state.error;
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="max-w-md rounded-xl border border-red-500/20 bg-red-500/10 p-6">
            <h2 className="text-lg font-semibold text-red-500 mb-2">Error al cargar la página</h2>
            <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono">
              {(err instanceof Error ? err.message : String(err)) ?? 'Error desconocido'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CreateCourseFromRepoPage() {
    const router = useRouter();
    const { isCollapsed } = useSidebar();
    const [isPending, startTransition] = useTransition();
    const [step, setStep] = useState<'form' | 'empty' | 'preview'>('form');
    const [empty, setEmpty] = useState<EmptySourceResult['empty'] | null>(null);
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
            if ('empty' in result) {
                setEmpty(result.empty);
                setStep('empty');
                return;
            }
            setPlan(result);
            setStep('preview');
        });
    };

    const handleCreateTemplate = () => {
        setError(null);
        startTransition(async () => {
            const created = await createTemplateInRepo(form);
            if ('error' in created) {
                setError(created.error);
                return;
            }
            // Template is committed -- re-analyse so the user lands on the
            // normal preview instead of having to start over.
            const result = await planImportFromRepo(form);
            if ('error' in result) {
                setError(result.error);
                return;
            }
            if ('empty' in result) {
                setError('La plantilla se creó pero el repositorio sigue apareciendo vacío. Revisa la rama configurada.');
                return;
            }
            setEmpty(null);
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
        <ErrorBoundary>
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
                                    Mínimo: permiso de solo lectura de contenido (Contents: Read-only). Para sincronizar cambios de la plataforma al repositorio en el futuro, concede también permiso de escritura (Contents: Read/Write) — es opcional por ahora.
                                </p>
                                <a
                                    href="/api/courses/template"
                                    className="mt-2 inline-block text-xs text-primary hover:underline"
                                >
                                    Descargar plantilla .zip
                                </a>
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

                    {step === 'empty' && empty && (
                        <div className="space-y-4">
                            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-500">
                                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">
                                        {empty.kind === 'repo'
                                            ? 'El repositorio está vacío (sin commits).'
                                            : `No hay archivos de curso en "${empty.path || '/'}".`}
                                    </p>
                                    <p className="mt-1 text-amber-500/80">
                                        Puedo crear la plantilla inicial del curso por ti, o puedes subirla a mano.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-card-bg p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                                    <GitBranch size={16} />
                                    {form.repoUrl} @ {empty.ref}
                                </div>
                                <p className="mb-2 text-xs text-muted">Se creará un único commit con estos archivos:</p>
                                <ul className="mb-3 space-y-1">
                                    {empty.templateFiles.map((file) => (
                                        <li key={file} className="font-mono text-xs text-foreground/80">
                                            {file}
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-muted">
                                    Mensaje del commit: <span className="font-mono">{empty.commitMessage}</span>
                                </p>
                                <p className="mt-3 text-xs text-muted">
                                    Requiere que el token tenga permiso de escritura (Contents: Read and Write).
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleCreateTemplate}
                                    disabled={isPending}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isPending && <Loader2 size={16} className="animate-spin" />}
                                    Crear plantilla en el repositorio
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmpty(null);
                                        setError(null);
                                        setStep('form');
                                    }}
                                    disabled={isPending}
                                    className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-card-bg disabled:opacity-70"
                                >
                                    Cancelar
                                </button>
                            </div>

                            <details className="rounded-xl border border-border bg-card-bg p-4">
                                <summary className="cursor-pointer text-xs font-medium text-foreground">
                                    Prefiero subirla a mano
                                </summary>
                                <p className="mt-3 text-xs text-muted">
                                    Descarga la plantilla, descomprímela{empty.path ? ` en "${empty.path}"` : ''} y súbela:
                                </p>
                                <a href="/api/courses/template" className="mt-2 inline-block text-xs text-primary hover:underline">
                                    Descargar plantilla .zip
                                </a>
                                <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
{`git clone https://github.com/${form.repoUrl.replace(/^https?:\/\/github\.com\//, '')}.git
cd ${form.repoUrl.split('/').pop()?.replace(/\.git$/, '') ?? 'repo'}
# copia aquí el contenido de curso-plantilla.zip${empty.path ? ` dentro de ${empty.path}/` : ''}
git add .
git commit -m "${empty.commitMessage}"
git push -u origin ${empty.ref}`}
                                </pre>
                            </details>
                        </div>
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
        </ErrorBoundary>
    );
}
