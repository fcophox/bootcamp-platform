'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { Plus, Award, Search, MoreHorizontal, Edit2, Trash2, Check, X, Eye, Menu } from 'lucide-react';
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
    Bootcamp: {
        id: number;
        title: string;
        icon: string | null;
        color: string | null;
    };
}

interface Bootcamp {
    id: number;
    title: string;
    icon: string | null;
    color: string | null;
}

export function CertificadosClient({ certificates, bootcamps }: { certificates: Certificate[], bootcamps: Bootcamp[] }) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const filteredCertificates = certificates.filter(cert => 
        cert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.Bootcamp?.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este certificado?')) return;
        setIsLoading(true);
        await deleteCertificate(id);
        setOpenMenuId(null);
        setIsLoading(false);
        router.refresh();
    };

    const handleToggleActive = async (id: number, currentlyActive: boolean) => {
        setIsLoading(true);
        if (currentlyActive) {
            await deactivateCertificate(id);
        } else {
            await activateCertificate(id);
        }
        setOpenMenuId(null);
        setIsLoading(false);
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center gap-3 h-full">
                            <button
                                onClick={() => setIsMobileOpen(true)}
                                className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground"
                            >
                                <Menu size={20} />
                            </button>
                            <h2 className="text-sm font-light text-foreground">Certificados</h2>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-6xl mx-auto">
                        {/* Title Section */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl font-semibold text-foreground mb-2">
                                    Gestión de Certificados
                                </h1>
                                <p className="text-muted">
                                    Crea y administra los certificados personalizados para cada bootcamp.
                                </p>
                            </div>
                            <Link
                                href="/cms/certificados/create"
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                <Plus size={20} />
                                <span>Crear certificado</span>
                            </Link>
                        </div>

                        {/* Search */}
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

                        {/* Certificates List */}
                        {filteredCertificates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCertificates.map((cert) => (
                                    <div
                                        key={cert.id}
                                        className="relative group rounded-2xl border border-border bg-card-bg overflow-hidden shadow-sm hover:border-primary/30 transition-all"
                                    >
                                        {/* Certificate Preview - Clickable */}
                                        <Link 
                                            href={`/cms/certificados/${cert.id}`}
                                            className="block aspect-[1.414/1] bg-white relative overflow-hidden cursor-pointer"
                                        >
                                            {cert.backgroundImageUrl ? (
                                                <img
                                                    src={cert.backgroundImageUrl}
                                                    alt={cert.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                                                    <Award size={48} className="text-slate-300" />
                                                </div>
                                            )}
                                            
                                            {/* Hover overlay */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                                                    <Edit2 size={14} className="inline mr-1.5" />
                                                    Editar
                                                </div>
                                            </div>
                                            
                                            {/* Status Badge */}
                                            <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                cert.isActive 
                                                    ? 'bg-green-500/90 text-white' 
                                                    : 'bg-slate-500/90 text-white'
                                            }`}>
                                                {cert.isActive ? 'Activo' : 'Inactivo'}
                                            </div>
                                        </Link>

                                        {/* Info */}
                                        <div className="p-4">
                                            <h3 className="font-semibold text-foreground mb-1 truncate">{cert.title}</h3>
                                            <p className="text-sm text-muted truncate">
                                                {cert.Bootcamp?.title || 'Sin bootcamp'}
                                            </p>
                                            <p className="text-xs text-muted mt-2">
                                                Creado: {new Date(cert.createdAt).toLocaleDateString('es-ES')}
                                            </p>
                                        </div>

                                        {/* Actions Menu */}
                                        <div className="absolute top-3 right-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === cert.id ? null : cert.id);
                                                }}
                                                className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
                                            >
                                                <MoreHorizontal size={16} className="text-slate-600" />
                                            </button>

                                            {openMenuId === cert.id && (
                                                <div className="absolute top-full right-0 mt-1 w-48 bg-card-bg border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in zoom-in-95">
                                                    <Link
                                                        href={`/cms/certificados/${cert.id}`}
                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors"
                                                    >
                                                        <Eye size={16} />
                                                        Ver / Editar
                                                    </Link>
                                                    
                                                    <button
                                                        onClick={() => handleToggleActive(cert.id, cert.isActive)}
                                                        disabled={isLoading}
                                                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                                                            cert.isActive 
                                                                ? 'text-amber-500 hover:bg-amber-500/10' 
                                                                : 'text-green-500 hover:bg-green-500/10'
                                                        }`}
                                                    >
                                                        {cert.isActive ? <X size={16} /> : <Check size={16} />}
                                                        {cert.isActive ? 'Desactivar' : 'Activar'}
                                                    </button>

                                                    <div className="h-px bg-border my-1" />

                                                    <button
                                                        onClick={() => handleDelete(cert.id)}
                                                        disabled={isLoading}
                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                        Eliminar
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
                                <p className="text-muted max-w-sm mx-auto mb-6">
                                    Crea tu primer certificado personalizado para tus bootcamps.
                                </p>
                                <Link
                                    href="/cms/certificados/create"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    <Plus size={20} />
                                    <span>Crear certificado</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
