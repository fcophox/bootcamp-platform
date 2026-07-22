'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { Plus, Award, Search, Trash2, Check, X, Eye, Menu, MoreHorizontal, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { deleteCertificate, activateCertificate, deactivateCertificate } from '@/app/actions/certificate';
import { useRouter } from 'next/navigation';

interface Certificate {
    id: number;
    bootcampId: number;
    title: string;
    backgroundImageUrl: string | null;
    isActive: boolean;
    createdAt: string;
    Bootcamp: { id: number; title: string; icon: string | null; color: string | null; };
}

interface Bootcamp {
    id: number; title: string; icon: string | null; color: string | null;
}

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText: string;
    isLoading?: boolean;
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, description, confirmText, isLoading }: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="relative w-full max-w-md bg-card-bg border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-50" />
                
                <div className="flex justify-between items-start mb-4">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500">
                        <Trash2 size={24} />
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg transition-colors text-muted hover:text-foreground">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{description}</p>
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-50"
                    >
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function CertificadosClient({ certificates, bootcamps }: { certificates: Certificate[], bootcamps: Bootcamp[] }) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; certificateId: number | null; certificateTitle: string }>({
        isOpen: false,
        certificateId: null,
        certificateTitle: ''
    });

    const filteredCertificates = certificates.filter(cert =>
        (cert.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cert.Bootcamp?.title || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-menu]')) setOpenMenuId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const openDeleteModal = (cert: Certificate) => {
        setDeleteModal({
            isOpen: true,
            certificateId: cert.id,
            certificateTitle: cert.title
        });
        setOpenMenuId(null);
    };

    const handleDelete = async () => {
        if (!deleteModal.certificateId) return;
        setIsLoading(true);
        await deleteCertificate(deleteModal.certificateId);
        setIsLoading(false);
        setDeleteModal({ isOpen: false, certificateId: null, certificateTitle: '' });
        router.refresh();
    };

    const handleToggleActive = async (id: number, currentlyActive: boolean) => {
        setIsLoading(true);
        if (currentlyActive) await deactivateCertificate(id);
        else await activateCertificate(id);
        setIsLoading(false);
        setOpenMenuId(null);
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center gap-3 h-full">
                            <button onClick={() => setIsMobileOpen(true)} className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground">
                                <Menu size={20} />
                            </button>
                            <h2 className="text-sm font-light text-foreground">Certificados</h2>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl font-semibold text-foreground mb-2">Gestión de Certificados</h1>
                                <p className="text-muted">Crea y administra los certificados personalizados para cada bootcamp.</p>
                            </div>
                            <Link href="/cms/certificados/create" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                                <Plus size={20} /><span>Crear certificado</span>
                            </Link>
                        </div>

                        <div className="mb-6 flex gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
                                <input
                                    type="text"
                                    placeholder="Buscar certificado..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card-bg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                        </div>

                        {filteredCertificates.length > 0 ? (
                            <div className="flex flex-col border border-border rounded-xl overflow-visible">
                                {filteredCertificates.map((cert, i) => (
                                    <div key={cert.id} className={`flex items-center gap-4 px-5 py-4 bg-card-bg hover:bg-hover-bg transition-colors ${i < filteredCertificates.length - 1 ? 'border-b border-border' : ''} ${i === 0 ? 'rounded-t-xl' : ''} ${i === filteredCertificates.length - 1 ? 'rounded-b-xl' : ''}`}>
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center shrink-0 overflow-hidden">
                                            {cert.backgroundImageUrl
                                                ? <img src={cert.backgroundImageUrl} alt={cert.title} className="w-full h-full object-cover" />
                                                : <Award size={18} className="text-slate-500" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{cert.title}</p>
                                            <p className="text-xs text-muted">{cert.Bootcamp?.title || 'Sin bootcamp'} · Creado: {new Date(cert.createdAt).toLocaleDateString('es-ES')}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0 ${cert.isActive ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                            {cert.isActive ? 'Activo' : 'Inactivo'}
                                        </span>

                                        {/* Menú 3 puntos */}
                                        <div className="relative shrink-0" data-menu>
                                            <button
                                                onClick={() => setOpenMenuId(openMenuId === cert.id ? null : cert.id)}
                                                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
                                            >
                                                <MoreHorizontal size={16} />
                                            </button>
                                            {openMenuId === cert.id && (
                                                <div className="absolute right-0 top-full mt-1 w-48 bg-card-bg border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in zoom-in-95 duration-150">
                                                    <Link
                                                        href={`/cms/certificados/${cert.id}`}
                                                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors"
                                                        onClick={() => setOpenMenuId(null)}
                                                    >
                                                        <Eye size={14} /> Editar
                                                    </Link>
                                                    <button
                                                        onClick={() => handleToggleActive(cert.id, cert.isActive)}
                                                        disabled={isLoading}
                                                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${cert.isActive ? 'text-amber-500 hover:bg-amber-500/10' : 'text-green-500 hover:bg-green-500/10'}`}
                                                    >
                                                        {cert.isActive ? <X size={14} /> : <Check size={14} />}
                                                        {cert.isActive ? 'Desactivar' : 'Activar'}
                                                    </button>
                                                    <div className="h-px bg-border my-1" />
                                                    <button
                                                        onClick={() => openDeleteModal(cert)}
                                                        disabled={isLoading}
                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 size={14} /> Eliminar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-border bg-card-bg p-12 text-center">
                                <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                    <Award size={32} className="text-muted" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-2">No hay certificados</h3>
                                <p className="text-muted max-w-sm mx-auto mb-6">Crea tu primer certificado personalizado para tus bootcamps.</p>
                                <Link href="/cms/certificados/create" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                                    <Plus size={20} /><span>Crear certificado</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Modal de confirmación para eliminar */}
            <ConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, certificateId: null, certificateTitle: '' })}
                onConfirm={handleDelete}
                title="Eliminar certificado"
                description={`¿Estás seguro de eliminar el certificado "${deleteModal.certificateTitle}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                isLoading={isLoading}
            />
        </div>
    );
}
