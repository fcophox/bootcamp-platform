'use client';


import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { BootcampCard } from '@/components/bootcamp-card';
import { BookOpen } from 'lucide-react';

interface Bootcamp {
    id: number;
    slug?: string;
    title: string;
    description: string;
    duration: string;
    level: string;
    students: number;
    startDate: string;
    isFrozen?: boolean;
}

interface DashboardClientProps {
    bootcamps: Bootcamp[];
    userName?: string;
}

export function DashboardClient({ bootcamps, userName = 'Francisco' }: DashboardClientProps) {
    const { isCollapsed } = useSidebar();



    return (
        <div className="min-h-screen bg-background">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content - with left margin for sidebar */}
            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header - Fixed */}
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background transition-all duration-300 ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center justify-between h-full">
                            <h2 className="text-sm font-light text-foreground">
                                {/* Dashboard */}
                            </h2>
                            <div className="flex items-center gap-4">
                                {/* Platform Status Badge */}
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    <span className="text-xs font-medium text-green-500">Sistema activo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content - Scrollable with top padding for fixed header */}
                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-5xl mx-auto">
                        {/* Welcome Section */}
                        <div className="mb-8">
                            <h1 className="text-xl font-semibold text-foreground mb-2">
                                ¡Te damos la bienvenida, {userName}! 👋
                            </h1>
                            <p className="text-muted">
                                Aquí puedes ver los bootcamps disponibles y tu progreso
                            </p>
                        </div>

                        {/* Available Bootcamps */}
                        <section className="mb-12">
                            <h2 className="text-xl font-semibold text-foreground mb-4">Bootcamps disponibles</h2>

                            {bootcamps.length > 0 ? (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                                    {bootcamps.map((bootcamp) => (
                                        <BootcampCard
                                            key={bootcamp.id}
                                            {...bootcamp}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-border p-12 text-center bg-card-bg/50">
                                    <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                        <BookOpen size={32} className="text-muted" />
                                    </div>
                                    <h3 className="text-lg font-medium text-foreground mb-2">No hay bootcamps disponibles</h3>
                                    <p className="text-muted max-w-sm mx-auto">
                                        Pronto se publicarán nuevos cursos. Mantente atento a las actualizaciones.
                                    </p>
                                </div>
                            )}
                        </section>


                    </div>
                </main>
            </div>
        </div>
    );
}
