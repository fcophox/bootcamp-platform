'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { User, ShieldCheck, GraduationCap, Mail, Search, Users, ShieldAlert, MoreHorizontal, Trash2, Loader2, UserPlus, UserMinus, AlertTriangle, X, Menu } from 'lucide-react';

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

// Componente de tooltip para los bootcamps
function BootcampTooltip({ bootcamp }: { bootcamp: { name: string; status: string; icon?: string } }) {
    const [showTooltip, setShowTooltip] = useState(false);
    
    return (
        <div 
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm border cursor-pointer transition-all hover:scale-110 ${
                bootcamp.status === 'invited'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                    : 'border-primary/30 bg-primary/10 text-primary'
            }`}>
                {bootcamp.icon ? (
                    <span className="text-xs">{bootcamp.icon}</span>
                ) : (
                    <GraduationCap size={14} />
                )}
            </div>
            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-card-bg border border-white/10 rounded-lg shadow-xl z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                    <span className="text-xs font-medium text-foreground">{bootcamp.name}</span>
                    {bootcamp.status === 'invited' && (
                        <span className="ml-1.5 text-[10px] text-amber-500">(Invitado)</span>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="border-4 border-transparent border-t-white/10"></div>
                    </div>
                </div>
            )}
        </div>
    );
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
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    interface UserWithRoles {
        id: string;
        email: string;
        role: string;
        bootcamps?: { name: string; status: string; icon?: string }[];
    }
    const [users, setUsers] = useState<UserWithRoles[]>([]);
    const [mounted, setMounted] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'alumno' | 'docente' | 'superadmin'>('all');
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
        setMounted(true);
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

        const handleScroll = () => {
            setOpenMenuId(null);
        };

        const handleResize = () => {
            setOpenMenuId(null);
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Orden de prioridad de roles
    const roleOrder = { superadmin: 0, docente: 1, alumno: 2 };

    const filteredUsers = users
        .filter(usr => {
            const matchesSearch = usr.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = roleFilter === 'all' || usr.role === roleFilter;
            return matchesSearch && matchesRole;
        })
        .sort((a, b) => {
            const orderA = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
            const orderB = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
            if (orderA !== orderB) return orderA - orderB;
            return a.email.localeCompare(b.email);
        });

    // Contadores por rol
    const roleCounts = {
        all: users.length,
        alumno: users.filter(u => u.role === 'alumno').length,
        docente: users.filter(u => u.role === 'docente').length,
        superadmin: users.filter(u => u.role === 'superadmin').length,
    };

    const openConfirmModal = (type: 'delete' | 'promote' | 'demote', user: UserWithRoles) => {

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
            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background/80 backdrop-blur-md transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileOpen(true)}
                            className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground"
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="text-sm font-light text-foreground">
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

                        {/* Filtros por rol */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setRoleFilter('all')}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                                    roleFilter === 'all'
                                        ? 'bg-primary/10 text-primary border border-primary/30'
                                        : 'bg-card-bg text-muted border border-border hover:bg-hover-bg hover:text-foreground'
                                }`}
                            >
                                <Users size={14} />
                                Todos
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    roleFilter === 'all' ? 'bg-primary/20' : 'bg-hover-bg'
                                }`}>{roleCounts.all}</span>
                            </button>
                            <button
                                onClick={() => setRoleFilter('superadmin')}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                                    roleFilter === 'superadmin'
                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                                        : 'bg-card-bg text-muted border border-border hover:bg-hover-bg hover:text-foreground'
                                }`}
                            >
                                <ShieldAlert size={14} />
                                Admins
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    roleFilter === 'superadmin' ? 'bg-amber-500/20' : 'bg-hover-bg'
                                }`}>{roleCounts.superadmin}</span>
                            </button>
                            <button
                                onClick={() => setRoleFilter('docente')}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                                    roleFilter === 'docente'
                                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                                        : 'bg-card-bg text-muted border border-border hover:bg-hover-bg hover:text-foreground'
                                }`}
                            >
                                <GraduationCap size={14} />
                                Docentes
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    roleFilter === 'docente' ? 'bg-blue-500/20' : 'bg-hover-bg'
                                }`}>{roleCounts.docente}</span>
                            </button>
                            <button
                                onClick={() => setRoleFilter('alumno')}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                                    roleFilter === 'alumno'
                                        ? 'bg-primary/10 text-primary border border-primary/30'
                                        : 'bg-card-bg text-muted border border-border hover:bg-hover-bg hover:text-foreground'
                                }`}
                            >
                                <User size={14} />
                                Alumnos
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    roleFilter === 'alumno' ? 'bg-primary/20' : 'bg-hover-bg'
                                }`}>{roleCounts.alumno}</span>
                            </button>
                        </div>

                        {/* List View */}
                        <div className="mb-10 flex flex-col border border-border rounded-xl overflow-visible">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-24 space-y-4 bg-card-bg rounded-xl">
                                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                    <p className="text-muted text-sm">Cargando usuarios...</p>
                                </div>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map((usr, i) => (
                                    <div
                                        key={usr.id}
                                        className={`flex items-center gap-4 px-5 py-3.5 bg-card-bg hover:bg-hover-bg transition-colors
                                            ${i < filteredUsers.length - 1 ? 'border-b border-border' : ''}
                                            ${i === 0 ? 'rounded-t-xl' : ''}
                                            ${i === filteredUsers.length - 1 ? 'rounded-b-xl' : ''}`}
                                    >
                                        {/* Avatar */}
                                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                                            usr.role === 'superadmin' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                            usr.role === 'docente'    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                                                        'bg-primary/10 text-primary border border-primary/20'
                                        }`}>
                                            {usr.role === 'superadmin' ? <ShieldAlert size={16} /> : usr.role === 'docente' ? <GraduationCap size={16} /> : <User size={16} />}
                                        </div>

                                        {/* Info principal */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-foreground truncate">{usr.email.split('@')[0]}</span>
                                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                                    usr.role === 'superadmin' ? 'border-amber-500/30 bg-amber-500/10 text-amber-500' :
                                                    usr.role === 'docente'    ? 'border-blue-500/30 bg-blue-500/10 text-blue-500' :
                                                                                'border-border bg-hover-bg text-muted'
                                                }`}>
                                                    {usr.role === 'superadmin' ? 'Admin' : usr.role === 'docente' ? 'Docente' : 'Alumno'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="flex items-center gap-1 text-xs text-muted">
                                                    <Mail size={10} className="text-primary/50" />{usr.email}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bootcamps como círculos con iconos */}
                                        {(usr.bootcamps || []).length > 0 && (
                                            <div className="flex items-center gap-1.5 mr-2">
                                                {usr.bootcamps?.map((bc, idx) => (
                                                    <BootcampTooltip key={idx} bootcamp={bc} />
                                                ))}
                                            </div>
                                        )}

                                        {/* Acciones */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (openMenuId === usr.id) {
                                                    setOpenMenuId(null);
                                                    setMenuPosition(null);
                                                } else {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setMenuPosition({ top: rect.bottom + 8, left: Math.max(8, rect.right - 176) });
                                                    setOpenMenuId(usr.id);
                                                }
                                            }}
                                            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-hover-bg text-muted hover:text-foreground transition-colors shrink-0"
                                        >
                                            {isProcessing === usr.id ? <Loader2 size={15} className="animate-spin text-primary" /> : <MoreHorizontal size={16} />}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center px-6 bg-card-bg rounded-xl">
                                    <div className="h-14 w-14 bg-hover-bg rounded-full flex items-center justify-center mb-4">
                                        <Users className="text-muted" size={28} />
                                    </div>
                                    <p className="text-base font-semibold text-foreground mb-1">No hay resultados</p>
                                    <p className="text-sm text-muted">No encontramos usuarios que coincidan con la búsqueda.</p>
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

            {/* Floating Portal Menu */}
            {mounted && openMenuId && (() => {
                const usr = users.find(u => u.id === openMenuId);
                if (!usr) return null;
                return createPortal(
                    <div 
                        ref={menuRef}
                        className="fixed w-44 bg-card-bg border border-white/10 rounded-xl shadow-2xl z-[9999] py-1.5 animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            top: menuPosition ? `${menuPosition.top}px` : undefined,
                            left: menuPosition ? `${menuPosition.left}px` : undefined,
                        }}
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
                    </div>,
                    document.body
                );
            })()}
        </div>
    );
}
