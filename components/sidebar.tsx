'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useSidebar } from './sidebar-context';
import { Home, ClipboardList, Bell, User, Globe, Moon, Sun, LogOut, ChevronLeft, ChevronRight, Award, MessageSquare, ClipboardCheck, BarChart3 } from 'lucide-react';
import { Tooltip } from './tooltip';
import { ThemeLogo } from './theme-logo';
import { createClient } from '@/utils/supabase/client';
import { getRoleFromEmail } from '@/utils/roles';
import { getUserRoleFromDBClient } from '@/utils/roles-client';

const AVAILABLE_AVATARS = [0, 1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20, 21, 43, 44, 45, 46, 47];

const getAvatarStyle = (indexStr: string | undefined | null) => {
    if (!indexStr || indexStr === '') return {};
    const index = parseInt(indexStr) || 0;
    if (!AVAILABLE_AVATARS.includes(index)) return {};
    return {
        backgroundImage: `url('/perfil/${index}.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    };
};

type MenuItem = { name: string; href: string; icon: React.ElementType; disabled?: boolean };
type MenuGroup = { group: string; items: MenuItem[] };
type MenuSection = MenuItem | MenuGroup;

const getMenuItems = (currentRole: string): MenuSection[] => {
    const studentItems: MenuItem[] = [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Encuestas', href: '/dashboard/encuestas', icon: ClipboardCheck },
    ];

    if (currentRole === 'superadmin') {
        return [
            { name: 'Bootcamps', href: '/cms', icon: Globe },
            { name: 'Encuestas', href: '/cms/encuestas', icon: BarChart3 },
            { name: 'Certificados', href: '/cms/certificados', icon: Award },
            { name: 'Feedbacks', href: '/cms/feedback', icon: MessageSquare },
            {
                group: 'Gestión',
                items: [
                    { name: 'Gestión de Usuarios', href: '/cms/usuarios', icon: User },
                ],
            },
        ];
    } else if (currentRole === 'docente') {
        return [
            { name: 'Bootcamps', href: '/cms', icon: Globe },
            { name: 'Encuestas', href: '/cms/encuestas', icon: BarChart3 },
        ];
    }

    return studentItems;
};

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter(); // Initialize router
    const { isCollapsed, toggleSidebar, isMobileOpen, setIsMobileOpen } = useSidebar();
    const { setTheme, resolvedTheme } = useTheme();

    // Close mobile sidebar on route change
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname, setIsMobileOpen]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isHoveringBorder, setIsHoveringBorder] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [userEmail, setUserEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [avatar, setAvatar] = useState('');
    // Inicializar rol desde sessionStorage para evitar flash en navegaciones
    const [role, setRole] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        // Buscar cualquier clave role_* en sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith('role_')) {
                return sessionStorage.getItem(key) || '';
            }
        }
        return '';
    });

    // Hydration check
    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        async function fetchUser() {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            if (!data.user) return;

            setUserEmail(data.user.email || '');
            setUserName(data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '');
            setAvatar(data.user.user_metadata?.avatar || '');

            const userId = data.user.id;
            const cacheKey = `role_${userId}`;

            // 1. Usar caché de sessionStorage para render inmediato
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                setRole(cached);
            } else {
                // Fallback rápido desde metadata/email mientras llega la DB
                const quick = getRoleFromEmail(data.user.email, data.user.user_metadata);
                setRole(quick);
            }

            // 2. Siempre verificar con la DB y actualizar caché
            const dbRole = await getUserRoleFromDBClient(userId);
            const finalRole = dbRole || getRoleFromEmail(data.user.email, data.user.user_metadata);
            sessionStorage.setItem(cacheKey, finalRole);
            setRole(finalRole);
        }
        fetchUser();

        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/');
    };

    const menuItems = getMenuItems(role);

    // No renderizar el nav hasta tener el rol resuelto (evita flash del menú incorrecto)
    const roleResolved = role !== '';

    return (
        <>
            {/* Backdrop for mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-45 md:hidden transition-opacity duration-300"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
            <aside className={`fixed left-0 top-0 h-screen border-r border-border bg-background flex flex-col z-50 transition-all duration-300 overflow-x-visible -translate-x-full md:translate-x-0 md:z-40 ${isCollapsed ? 'md:w-16' : 'md:w-64'} ${isMobileOpen ? 'translate-x-0 w-64' : ''}`}>

                {/* Interactive Right Border - Full Height */}
                <div
                    className="absolute right-0 top-0 h-full w-3 cursor-pointer z-[999] group hidden md:block"
                    onMouseEnter={() => setIsHoveringBorder(true)}
                    onMouseLeave={() => setIsHoveringBorder(false)}
                    onClick={toggleSidebar}
                >
                    {/* Hover indicator line */}
                    <div className={`absolute right-0 top-0 h-full w-0.5 transition-all duration-200 ${isHoveringBorder ? 'bg-foreground/20' : 'bg-transparent'}`} />
                    
                    {/* Chevron button - appears on hover, centered vertically */}
                    <div
                        className={`absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-border bg-hover-bg hover:bg-background transition-all duration-200 flex items-center justify-center shadow-sm ${isHoveringBorder ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
                        title={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                    >
                        {isCollapsed ? (
                            <ChevronRight size={14} className="text-foreground" />
                        ) : (
                            <ChevronLeft size={14} className="text-foreground" />
                        )}
                    </div>
                </div>

            {/* Logo */}
            <div className="h-[60px] border-b border-border relative flex items-center px-4 md:px-4">
                {!isCollapsed && (
                    <div className="flex items-center">
                        <div className="relative h-9 w-32 overflow-hidden">
                            <ThemeLogo />
                        </div>
                    </div>
                )}
                {isCollapsed && (
                    <div className="w-full flex items-center justify-center">
                        <div className="relative h-8 w-8 overflow-hidden">
                            <Image
                                src="/brand/favicon.png"
                                alt="Synaptia"
                                fill
                                className="object-contain"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className={`flex-1 transition-all overflow-y-auto overflow-x-visible ${isCollapsed ? 'px-2 py-4' : 'p-4'}`}>
                {roleResolved && (
                <ul className="space-y-1">
                    {menuItems.map((section) => {
                        // Grupo con separador
                        if ('group' in section) {
                            return (
                                <li key={section.group}>
                                    <div className="mt-4 mb-1">
                                        {!isCollapsed && (
                                            <p className="px-3 text-[10px] font-semibold text-muted uppercase tracking-widest">
                                                {section.group}
                                            </p>
                                        )}
                                        {isCollapsed && <div className="mx-2 border-t border-border/50 my-2" />}
                                    </div>
                                    <ul className="space-y-1">
                                        {section.items.map((item) => {
                                            const isActive = pathname === item.href;
                                            const Icon = item.icon;
                                            const linkContent = item.disabled ? (
                                                <div className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors text-muted/50 cursor-not-allowed ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}`}>
                                                    <Icon size={20} className="flex-shrink-0" />
                                                    {!isCollapsed && <span>{item.name}</span>}
                                                </div>
                                            ) : (
                                                <Link href={item.href} className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-hover-bg text-foreground' : 'text-muted hover:bg-hover-bg hover:text-foreground'} ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}`}>
                                                    <Icon size={20} className="flex-shrink-0" />
                                                    {!isCollapsed && <span>{item.name}</span>}
                                                </Link>
                                            );
                                            return (
                                                <li key={item.name}>
                                                    {isCollapsed ? <Tooltip content={item.name} side="right">{linkContent}</Tooltip> : linkContent}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                            );
                        }

                        // Item normal
                        const item = section as MenuItem;
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        const linkContent = item.disabled ? (
                            <div className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors text-muted/50 cursor-not-allowed ${isCollapsed ? 'justify-center items-center px-2 py-2' : 'px-3 py-2'}`}>
                                <Icon size={20} className="flex-shrink-0" />
                                {!isCollapsed && <span>{item.name}</span>}
                            </div>
                        ) : (
                            <Link
                                href={item.href}
                                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-hover-bg text-foreground'
                                    : 'text-muted hover:bg-hover-bg hover:text-foreground'
                                    } ${isCollapsed ? 'justify-center items-center px-2 py-2' : 'px-3 py-2'}`}
                            >
                                <Icon size={20} className="flex-shrink-0" />
                                {!isCollapsed && <span>{item.name}</span>}
                            </Link>
                        );

                        return (
                            <li key={item.name}>
                                {isCollapsed ? (
                                    <Tooltip content={item.name} side="right">
                                        {linkContent}
                                    </Tooltip>
                                ) : (
                                    linkContent
                                )}
                            </li>
                        );
                    })}
                </ul>
                )}
            </nav>

            {/* User Section */}
            <div className={`border-t border-border relative transition-all ${isCollapsed ? 'p-2' : 'p-4'}`} ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`w-full flex items-center gap-3 rounded-lg hover:bg-hover-bg transition-colors ${isCollapsed ? 'justify-center py-2' : 'px-4 py-3'}`}
                    title={isCollapsed ? userName : ''}
                >
                    <div className={`rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary border border-primary/20 flex-shrink-0 relative overflow-hidden ${isCollapsed ? 'h-8 w-8' : 'h-9 w-9'}`}>
                        {avatar ? (
                            <div className="absolute inset-0 w-full h-full" style={getAvatarStyle(avatar)} />
                        ) : (
                            userName.charAt(0).toUpperCase()
                        )}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                                <span className="truncate">{userName}</span>
                                {role === 'superadmin' && (
                                    <span 
                                        className="flex-shrink-0 flex items-center justify-center rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-extrabold text-red-600 dark:text-red-400" 
                                        style={{ width: '18px', height: '18px' }}
                                        title="Administrador"
                                    >
                                        A
                                    </span>
                                )}
                                {role === 'docente' && (
                                    <span 
                                        className="flex-shrink-0 flex items-center justify-center rounded-full bg-blue-500/15 border border-blue-500/30 text-[10px] font-extrabold text-blue-600 dark:text-blue-400" 
                                        style={{ width: '18px', height: '18px' }}
                                        title="Docente"
                                    >
                                        D
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-muted truncate">{userEmail}</p>
                        </div>
                    )}
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                    <div className={`absolute bottom-full mb-2 rounded-lg border border-border bg-background shadow-lg overflow-hidden z-50 ${isCollapsed ? 'left-full ml-2 w-56' : 'left-4 right-4'}`}>
                        {/* User Info Header */}
                        <div className="px-4 py-3 border-b border-border">
                            <p className="text-base font-medium text-foreground flex items-center gap-1.5">
                                <span className="truncate">{userName}</span>
                                {role === 'superadmin' && (
                                    <span 
                                        className="flex-shrink-0 flex items-center justify-center rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-extrabold text-red-600 dark:text-red-400" 
                                        style={{ width: '18px', height: '18px' }}
                                        title="Administrador"
                                    >
                                        A
                                    </span>
                                )}
                                {role === 'docente' && (
                                    <span 
                                        className="flex-shrink-0 flex items-center justify-center rounded-full bg-blue-500/15 border border-blue-500/30 text-[10px] font-extrabold text-blue-600 dark:text-blue-400" 
                                        style={{ width: '18px', height: '18px' }}
                                        title="Docente"
                                    >
                                        D
                                    </span>
                                )}
                            </p>
                            <p className="text-sm text-muted">{userEmail}</p>
                        </div>

                        {/* Menu Items */}
                        <div className="py-1">
                            <Link href="/dashboard/perfil" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors">
                                <User size={20} />
                                <span>Mi perfil</span>
                            </Link>

                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors">
                                <Globe size={20} />
                                <span>Idioma</span>
                            </button>

                            <button
                                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors"
                            >
                                {mounted && resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                                <span>Modo: {mounted && resolvedTheme === 'dark' ? 'Claro' : 'Oscuro'}</span>
                            </button>
                        </div>

                        {/* Logout */}
                        <div className="border-t border-border">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-hover-bg transition-colors"
                            >
                                <LogOut size={20} />
                                <span>Cerrar sesión</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
        </>
    );
}
