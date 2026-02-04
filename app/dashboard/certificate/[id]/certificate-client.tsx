'use client';

import { useSidebar } from '@/components/sidebar-context';
import { Sidebar } from '@/components/sidebar';
import Link from 'next/link';
import { ArrowLeft, Download, CheckCircle, Share2, Award, Printer } from 'lucide-react';
import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CertificateClient({ bootcamp }: { bootcamp: any }) {
    const { isCollapsed } = useSidebar();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch for sidebar state
    useEffect(() => {
        setMounted(true);

        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => {
            return Math.random() * (max - min) + min;
        }

        const interval: NodeJS.Timeout = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            // since particles fall down, start a bit higher than random
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        return () => clearInterval(interval);
    }, []);

    const sidebarWidthClass = !mounted ? 'ml-64' : (isCollapsed ? 'ml-16' : 'ml-64');

    // Mock User Data
    const userName = "Francisco";
    const completionDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />

            <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarWidthClass}`}>
                {/* Header */}
                <header className="h-[60px] border-b border-border flex items-center px-6 justify-between bg-card-bg/50 backdrop-blur-sm sticky top-0 z-1">
                    <div className="flex items-center gap-4">
                        <Link href={`/dashboard/bootcamp/${bootcamp.id}`} className="text-muted hover:text-foreground transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-sm font-medium text-md">Certificación</h1>
                    </div>
                </header>

                <main className="flex-1 p-6 md:p-12 flex items-center justify-center min-h-[calc(100vh-60px)]">
                    <div className="max-w-6xl w-full">
                        <div className="flex flex-col mb-12 text-center items-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                                <Award size={32} className="text-white" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold mb-4">¡Felicitaciones, {userName}!</h1>
                            <p className="text-muted text-lg max-w-2xl">
                                Has completado exitosamente el <strong>{bootcamp.title}</strong>. Aquí tienes tu certificado oficial que valida tus conocimientos.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                            {/* Left Column: Details & Skills */}
                            <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                                <div className="bg-card-bg border border-border rounded-2xl p-8 shadow-sm">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <CheckCircle className="text-green-500" size={20} />
                                        Habilidades Adquiridas
                                    </h3>

                                    <div className="space-y-4">
                                        <p className="text-sm text-muted">
                                            Este certificado valida que el estudiante ha demostrado dominio en las siguientes áreas:
                                        </p>
                                        <ul className="grid grid-cols-1 gap-3">
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {bootcamp.modules?.map((module: any) => (
                                                <li key={module.id} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-background border border-border/50">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                    <span className="leading-tight">{module.title}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <button className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                                        <Download size={20} />
                                        Descargar Certificado (PDF)
                                    </button>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button className="py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:opacity-80 transition-all flex items-center justify-center gap-2 border border-border">
                                            <Share2 size={18} /> Compartir
                                        </button>
                                        <button className="py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:opacity-80 transition-all flex items-center justify-center gap-2 border border-border">
                                            <Printer size={18} /> Imprimir
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Certificate Preview */}
                            <div className="relative animate-in slide-in-from-right-4 duration-500 delay-100">
                                <div className="relative aspect-[1.414/1] w-full bg-white text-black p-8 shadow-2xl rounded-sm overflow-hidden border-8 border-double border-slate-200 group">
                                    {/* Decorative Background */}
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                                    <div className="absolute inset-0 border-[20px] border-slate-100 pointer-events-none"></div>

                                    {/* Certificate Content */}
                                    <div className="relative h-full flex flex-col items-center justify-center text-center p-4 border-4 border-slate-800">

                                        {/* Header */}
                                        <div className="">
                                            <div className="text-2xl font-serif text-slate-800 uppercase tracking-widest">Certificado</div>
                                            <div className="text-xl font-serif text-slate-600 italic">de finalización</div>
                                        </div>

                                        {/* Content */}
                                        <div className="space-y-1 flex-1 flex flex-col justify-center w-full">
                                            <p className="text-slate-500 font-serif italic text-sm">Se otorga el presente documento a:</p>

                                            <div className="border-b-1 border-slate-300 pb-1 w-3/4 mx-auto">
                                                <h2 className="text-lg font-serif font-bold text-slate-900 font-script">{userName}</h2>
                                            </div>

                                            <p className="text-slate-500 font-serif italic text-sm">Por haber completado satisfactoriamente el programa:</p>

                                            <div className="border-b-1 border-slate-300 pb-1 w-3/4 mx-auto">
                                                <h3 className="text-lg font-serif text-amber-600 font-bold">{bootcamp.title}</h3>
                                            </div>

                                            <p className="text-[10px] font-semibold text-slate-400">{completionDate}</p>
                                        </div>

                                        {/* Footer / Signatures */}
                                        <div className="w-full flex justify-between items-end px-16">
                                            <div className="text-center">
                                                <div className="w-32 border-t border-slate-500 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Instructor</div>
                                            </div>
                                            <div className="h-8 w-8 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner ring-4 ring-amber-100">
                                                <Award size={15} />
                                            </div>
                                            <div className="text-center">
                                                <div className="w-32 border-t border-slate-500 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Director</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* "Preview" Overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none"></div>
                                </div>

                                {/* Shadow Effect underneath */}
                                <div className="absolute -bottom-4 -right-4 -z-10 w-full h-full bg-black/5 rounded-sm transform rotate-1"></div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
