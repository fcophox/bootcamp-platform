'use client';


import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { BootcampCard } from '@/components/bootcamp-card';
import { BookOpen, PlayCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MobileMenuButton } from '@/components/mobile-menu-button';

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
    icon?: string;
    color?: string;
    imageUrl?: string;
    progress?: number;
}

interface ContinueLearning {
    bootcampId: number;
    bootcampTitle: string;
    lessonId: number;
    lessonTitle: string;
    completedCount: number;
    totalCount: number;
    icon?: string;
    color?: string;
}

interface DashboardClientProps {
    bootcamps: Bootcamp[];
    userName?: string;
    continueLearning: ContinueLearning | null;
}

const getBootcampCoverImage = (bootcamp: Bootcamp) => {
    if (bootcamp.imageUrl) {
        return bootcamp.imageUrl;
    }
    const id = bootcamp.id;
    // Return high-quality Unsplash image URLs based on bootcamp ID
    if (id === 8) {
        return 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?q=80&w=600&auto=format&fit=crop'; // UX Design
    }
    if (id === 12) {
        return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop'; // AI abstract
    }
    // Fallback images
    const fallbacks = [
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600&auto=format&fit=crop'
    ];
    return fallbacks[id % fallbacks.length];
};

export function DashboardClient({ bootcamps, userName = 'Francisco', continueLearning }: DashboardClientProps) {
    const { isCollapsed } = useSidebar();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(3);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setItemsPerPage(1);
            } else if (window.innerWidth < 1024) {
                setItemsPerPage(2);
            } else {
                setItemsPerPage(3);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // If there are less bootcamps than itemsPerPage, cap itemsPerPage to bootcamps.length
    const activeItemsPerPage = Math.min(itemsPerPage, bootcamps.length || 1);
    const totalSlides = Math.max(0, bootcamps.length - activeItemsPerPage + 1);

    const handleNext = () => {
        if (currentIndex < totalSlides - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setCurrentIndex(0); // Loop back
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        } else {
            setCurrentIndex(totalSlides - 1); // Loop to end
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content - with left margin for sidebar */}
            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header - Fixed */}
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-3">
                                <MobileMenuButton />
                                <h2 className="text-sm font-light text-foreground">
                                    {/* Dashboard */}
                                </h2>
                            </div>
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
                    <div className="max-w-5xl mx-auto space-y-10">
                        {/* Welcome Section */}
                        <div>
                            <h1 className="text-xl font-semibold text-foreground mb-2">
                                ¡Te damos la bienvenida, {userName}! 👋
                            </h1>
                            <p className="text-muted">
                                Aquí puedes ver los bootcamps disponibles y tu progreso
                            </p>
                        </div>

                        {/* Banner Section - hidden for now
                        <div className="w-full">
                            <div className="w-full bg-white text-black py-6 px-8 rounded-xl border border-white/10 shadow-lg flex items-center justify-center font-medium text-base text-center tracking-wide hover:shadow-xl transition-all duration-300">
                                Banner ej "Pronto Master Class"
                            </div>
                        </div>
                        */}

                        {/* Continua Aprendiendo Section */}
                        <section>
                            <h2 className="text-md font-semibold text-foreground mb-4">Continua aprendiendo</h2>
                            {continueLearning ? (
                                <Link 
                                    href={`/dashboard/bootcamp/${continueLearning.bootcampId}/clase/${continueLearning.lessonId}`}
                                    className="group flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 bg-background border border-border rounded-xl sm:rounded-2xl hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                                >
                                    <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto min-w-0">
                                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform duration-300">
                                            <PlayCircle className="h-5 w-5 sm:h-7 sm:w-7 fill-primary/10" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[9px] sm:text-[10px] text-primary font-bold tracking-wider uppercase block leading-tight">{continueLearning.bootcampTitle}</span>
                                            <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5 group-hover:text-primary transition-colors duration-300">
                                                {continueLearning.lessonTitle}
                                            </h3>
                                            <p className="text-[11px] sm:text-xs text-muted mt-0.5 sm:mt-1">
                                                {continueLearning.completedCount} de {continueLearning.totalCount} lecciones
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-primary mt-3 sm:mt-0 group-hover:translate-x-1 transition-transform duration-300">
                                        <span>Ir a siguiente lección</span>
                                        <ChevronRight size={14} />
                                    </div>
                                </Link>
                            ) : (
                                <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-card-bg border border-border rounded-2xl">
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted shrink-0">
                                            <BookOpen size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">
                                                No tienes lecciones pendientes
                                            </h3>
                                            <p className="text-xs text-muted mt-1">
                                                Inscríbete en un bootcamp o completa tus módulos para ver tu progreso aquí.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Available Bootcamps */}
                        <section className="relative">
                            <h2 className="text-xl font-semibold text-foreground mb-6">Bootcamps disponibles</h2>

                            {bootcamps.length > 0 ? (
                                <div className="relative group/carousel">
                                    {/* Slider Viewport */}
                                    <div className="overflow-hidden -mx-3 px-3 py-1">
                                        <div 
                                            className="flex transition-transform duration-500 ease-out"
                                            style={{
                                                transform: `translateX(-${currentIndex * (100 / activeItemsPerPage)}%)`
                                            }}
                                        >
                                            {bootcamps.map((bootcamp) => (
                                                <div 
                                                    key={bootcamp.id} 
                                                    className="w-full md:w-1/2 lg:w-1/3 shrink-0 px-3 flex"
                                                >
                                                    <BootcampCard
                                                        {...bootcamp}
                                                        imageUrl={getBootcampCoverImage(bootcamp)}
                                                        className="w-full flex-1"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Carousel Controls */}
                                    {totalSlides > 1 && (
                                        <>
                                            <button 
                                                onClick={handlePrev}
                                                className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-4 w-10 h-10 rounded-full bg-card-bg border border-border text-foreground shadow-lg flex items-center justify-center z-10 transition-all hover:bg-hover-bg active:scale-95 opacity-0 group-hover/carousel:opacity-100"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                            <button 
                                                onClick={handleNext}
                                                className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-4 w-10 h-10 rounded-full bg-white text-black border border-border shadow-lg flex items-center justify-center z-10 transition-all hover:bg-neutral-100 active:scale-95 opacity-100"
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        </>
                                    )}

                                    {/* Page Indicators */}
                                    {totalSlides > 1 && (
                                        <div className="flex justify-center gap-2 mt-6">
                                            {Array.from({ length: totalSlides }).map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setCurrentIndex(idx)}
                                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                                        currentIndex === idx 
                                                            ? 'bg-primary w-5' 
                                                            : 'bg-border hover:bg-muted'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    )}
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
