'use client';

import { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { User, ShieldCheck, GraduationCap, Mail, Search, Users, ShieldAlert, MoreHorizontal, Trash2, Loader2, Zap, UserPlus, UserMinus, AlertTriangle, X } from 'lucide-react';
import { getAllUsersWithRoles } from '@/utils/roles-client';
import { deleteUser, updateUserRole } from './actions';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText: string;
    confirmVariant?: 'primary' | 'danger' | 'warning';
    isLoading?: boolean;
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, description, confirmText, confirmVariant = 'primary', isLoading }: ConfirmModalProps) {
    if (!isOpen) return null;

    const variantStyles = {
        primary: 'bg-primary text-white hover:bg-primary/90 shadow-[0_0_15px_rgba(79,70,229,0.3)]',
        danger: 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
        warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="relative w-full max-w-md bg-card-bg border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
                
                <div className="flex justify-between items-start mb-4">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${confirmVariant === 'danger' ? 'bg-red-500/10 text-red-500' : confirmVariant === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                        {confirmVariant === 'danger' ? <Trash2 size={24} /> : confirmVariant === 'warning' ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
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
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${variantStyles[confirmVariant]} disabled:opacity-50`}
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

export default function UsuariosCMSPage() {
    const { isCollapsed } = useSidebar();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Modal state
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: 'delete' | 'promote' | 'demote' | null;
        userId: string | null;
        email: string | null;
    }>({
        isOpen: false,
        type: null,
        userId: null,
        email: null
    });

    useEffect(() => {
        async function fetchUsers() {
            setLoading(true);
            const data = await getAllUsersWithRoles();
            setUsers(data);
            setLoading(false);
        }
        fetchUsers();

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredUsers = users.filter(usr => {
        return usr.email.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const openConfirmModal = (type: 'delete' | 'promote' | 'demote', user: any) => {
        setModalConfig({
            isOpen: true,
            type,
            userId: user.id,
            email: user.email
        });
        setOpenMenuId(null);
    };

    const handleConfirmedAction = async () => {
        if (!modalConfig.userId || !modalConfig.type) return;

        const userId = modalConfig.userId;
        setIsProcessing(userId);

        if (modalConfig.type === 'delete') {
            const res = await deleteUser(userId);
            if (res.success) {
                setUsers(users.filter(u => u.id !== userId));
            } else {
                alert('Error al eliminar: ' + res.error);
            }
        } else {
            const newRole = modalConfig.type === 'promote' ? 'docente' : 'alumno';
            const res = await updateUserRole(userId, newRole);
            if (res.success) {
                setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            } else {
                alert('Error al cambiar rol: ' + res.error);
            }
        }

        setIsProcessing(null);
        setModalConfig({ isOpen: false, type: null, userId: null, email: null });
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background/80 backdrop-blur-md transition-all duration-300 ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border flex items-center justify-between">
                        <h2 className="text-sm font-light text-foreground flex items-center gap-2">
                            <Users size={16} className="text-primary" />
                            Gestión de Usuarios
                        </h2>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">Gestión de Usuarios</h1>
                                <p className="text-muted">Administra todos los perfiles, roles y accesos de la plataforma en un solo lugar.</p>
                            </div>

                            <div className="relative w-full md:w-96 group">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por email o contenido..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl border border-white/10 bg-muted/10 text-sm placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all duration-300 shadow-inner"
                                />
                            </div>
                        </div>

                        {/* List View */}
                        <div className="mb-10 overflow-visible rounded-2xl border border-white/5 bg-card-bg/20 shadow-2xl backdrop-blur-md">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                    <p className="text-muted font-medium animate-pulse">Sincronizando comunidad...</p>
                                </div>
                            ) : filteredUsers.length > 0 ? (
                                <div className="overflow-x-auto min-h-[400px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-muted/10 border-b border-white/10">
                                            <tr>
                                                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted">Usuario</th>
                                                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted">Correo</th>
                                                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted text-center">Rol</th>
                                                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted">Cursos Habilitados</th>
                                                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredUsers.map((usr) => (
                                                <tr key={usr.id} className="group hover:bg-white/5 transition-all duration-300 border-b border-white/[0.03]">
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-2xl transition-transform group-hover:scale-105 duration-300 ${usr.role === 'superadmin' ? 'bg-amber-100/10 text-amber-500 border border-amber-500/20' : usr.role === 'docente' ? 'bg-blue-100/10 text-blue-500 border border-blue-500/20' : 'bg-gray-100/10 text-gray-400 border border-white/5'}`}>
                                                                {usr.role === 'superadmin' ? <ShieldAlert size={18} /> : usr.role === 'docente' ? <GraduationCap size={18} /> : <User size={18} />}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{usr.email.split('@')[0]}</span>
                                                                <span className="text-[10px] text-muted uppercase tracking-wider mt-0.5 opacity-50">ID: {usr.id.slice(0, 8).toUpperCase()}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-2.5 text-xs font-medium text-muted/80">
                                                            <Mail size={13} className="text-primary/50" />
                                                            {usr.email}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-sm ${
                                                            usr.role === 'superadmin' ? 'border-amber-500/30 bg-amber-500/10 text-amber-500' :
                                                            usr.role === 'docente' ? 'border-blue-500/30 bg-blue-500/10 text-blue-500' :
                                                            'border-white/10 bg-white/5 text-muted-foreground'
                                                        }`}>
                                                            {usr.role === 'superadmin' ? 'Admin' : usr.role === 'docente' ? 'Docente' : 'Alumno'}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                                                            {(usr.bootcamps || []).length > 0 ? (
                                                                usr.bootcamps.map((bc: any, idx: number) => (
                                                                    <div key={idx} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shadow-sm ${
                                                                        bc.status === 'invited' 
                                                                            ? 'border-amber-500/20 bg-amber-500/5 text-amber-500/70' 
                                                                            : 'border-primary/20 bg-primary/5 text-primary/80'
                                                                    }`}>
                                                                        {bc.name}
                                                                        {bc.status === 'invited' && <span className="text-[8px] opacity-60">⏳</span>}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span className="text-[9px] text-muted-foreground uppercase opacity-40">Sin Registros</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-right relative">
                                                        <div className="flex justify-end items-center gap-2">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenMenuId(openMenuId === usr.id ? null : usr.id);
                                                                }}
                                                                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted hover:text-foreground transition-all"
                                                            >
                                                                {isProcessing === usr.id ? <Loader2 size={16} className="animate-spin text-primary" /> : <MoreHorizontal size={18} />}
                                                            </button>

                                                            {openMenuId === usr.id && (
                                                                <div 
                                                                    ref={menuRef}
                                                                    className="absolute right-8 top-12 w-44 bg-card-bg border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-200"
                                                                >
                                                                    {usr.role === 'alumno' ? (
                                                                        <button 
                                                                            onClick={() => openConfirmModal('promote', usr)}
                                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors text-left"
                                                                        >
                                                                            <UserPlus size={14} />
                                                                            Convertir en Docente
                                                                        </button>
                                                                    ) : usr.role === 'docente' ? (
                                                                        <button 
                                                                            onClick={() => openConfirmModal('demote', usr)}
                                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400 hover:bg-white/10 transition-colors text-left"
                                                                        >
                                                                            <UserMinus size={14} />
                                                                            Convertir en Alumno
                                                                        </button>
                                                                    ) : null}

                                                                    {usr.role !== 'superadmin' && (
                                                                        <div className="h-px bg-white/5 my-1" />
                                                                    )}

                                                                    <button 
                                                                        onClick={() => openConfirmModal('delete', usr)}
                                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors text-left font-medium"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                        Eliminar usuario
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 px-6">
                                    <div className="h-16 w-16 bg-muted/10 rounded-full flex items-center justify-center">
                                        <Users className="text-muted" size={32} />
                                    </div>
                                    <div className="max-w-xs">
                                        <p className="text-lg font-semibold text-foreground">No hay resultados</p>
                                        <p className="text-sm text-muted">No encontramos usuarios que coincidan con la búsqueda.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Global Confirm Modal */}
            <ConfirmModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                onConfirm={handleConfirmedAction}
                isLoading={isProcessing !== null}
                title={
                    modalConfig.type === 'delete' ? 'Eliminar usuario' :
                    modalConfig.type === 'promote' ? 'Promover a Docente' : 'Cambiar a Alumno'
                }
                description={
                    modalConfig.type === 'delete' 
                        ? `¿Estás completamente seguro de eliminar a ${modalConfig.email}? Esta acción no se puede deshacer.` :
                    modalConfig.type === 'promote' 
                        ? `¿Confirmas que deseas convertir a ${modalConfig.email} en DOCENTE de la academia?` :
                        `¿Confirmas que deseas convertir a ${modalConfig.email} en ALUMNO de la academia?`
                }
                confirmText={
                    modalConfig.type === 'delete' ? 'Eliminar permanentemente' :
                    modalConfig.type === 'promote' ? 'Convertir ahora' : 'Cambiar rol'
                }
                confirmVariant={modalConfig.type === 'delete' ? 'danger' : 'primary'}
            />
        </div>
    );
}
