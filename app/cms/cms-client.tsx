'use client';

import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { FileText, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { BootcampCard } from '@/components/bootcamp-card';

import { deleteBootcamp } from '@/app/actions/bootcamp';
import { useRouter } from 'next/navigation';

interface Bootcamp {
    id: number;
    title: string;
    description: string;
    duration: string;
    level: string;
    students: number;
    startDate: string;
}

interface CmsClientProps {
    bootcamps: Bootcamp[];
    userName?: string;
}

import { ConfirmationModal } from '@/components/confirmation-modal';
import { useState } from 'react';

export function CmsClient({ bootcamps, userName = 'Francisco' }: CmsClientProps) {
    const { isCollapsed } = useSidebar();
    const router = useRouter();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bootcampToDelete, setBootcampToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = (id: number) => {
        setBootcampToDelete(id);
        setIsModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (bootcampToDelete === null) return;

        setIsDeleting(true);
        try {
            await deleteBootcamp(bootcampToDelete);
            router.refresh();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('Ocurrió un error al eliminar el bootcamp.');
        } finally {
            setIsDeleting(false);
            setBootcampToDelete(null);
        }
    };

    const handleCloseModal = () => {
        if (!isDeleting) {
            setIsModalOpen(false);
            setBootcampToDelete(null);
        }
    };

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
                                Content Management
                            </h2>
                            <div className="flex items-center gap-4">
                                {/* User Avatar Removed */}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl font-semibold text-foreground mb-2">
                                    Gestión de Contenido
                                </h1>
                                <p className="text-muted">
                                    Administra los recursos, lecciones y materiales del bootcamp.
                                </p>
                            </div>
                            <Link
                                href="/cms/bootcamp/create"
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                <Plus size={20} />
                                <span>Crear bootcamp</span>
                            </Link>
                        </div>

                        {/* Search and Filters */}
                        <div className="mb-6 flex gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
                                <input
                                    type="text"
                                    placeholder="Buscar contenido..."
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card-bg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Content List */}
                        {bootcamps.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {bootcamps.map((bootcamp) => (
                                    <BootcampCard
                                        key={bootcamp.id}
                                        {...bootcamp}
                                        href={`/cms/bootcamp/${bootcamp.id}/manage`}
                                        buttonText="Editar"
                                        onDelete={handleDeleteClick}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-border bg-card-bg p-8 text-center">
                                <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                    <FileText size={32} className="text-muted" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-2">No hay contenidos recientes</h3>
                                <p className="text-muted max-w-sm mx-auto">
                                    Selecciona una categoría o crea nuevo contenido para comenzar a gestionar la plataforma.
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onConfirm={handleConfirmDelete}
                title="Eliminar Bootcamp"
                message="¿Estás seguro de que deseas eliminar este bootcamp? Esta acción no se puede deshacer y perderás todo el contenido asociado."
                isLoading={isDeleting}
            />
        </div>
    );
}
