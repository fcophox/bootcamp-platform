'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useSidebar } from './sidebar-context';
import { Home, BarChart3, ClipboardList, Bell, User, Globe, Moon, Sun, LogOut, ChevronLeft, ChevronRight, Award } from 'lucide-react';
import { Tooltip } from './tooltip';

const menuItems = [
    {
        name: 'Dashboard',
        href: '/dashboard',
        icon: Home,
    },
    {
        name: 'Estadísticas',
        href: '/dashboard/estadisticas',
        icon: BarChart3,
    },
    {
        name: 'Tareas',
        href: '/dashboard/tareas',
        icon: ClipboardList,
    },
    {
        name: 'Notificaciones',
        href: '/dashboard/notificaciones',
        icon: Bell,
    },
    {
        name: 'Certificación',
        href: '/dashboard/certificacion',
        icon: Award,
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const { isCollapsed, toggleSidebar } = useSidebar();
    const { setTheme, resolvedTheme } = useTheme();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        // eslint-disable-next-line
        setMounted(true);
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

    const userName = 'fcojhormazabalh';
    const userEmail = 'fcojhormazabalh@gmail.com';

    return (
        <aside className={`fixed left-0 top-0 h-screen border-r border-border bg-card-bg flex flex-col z-10 transition-all duration-300 overflow-x-visible ${isCollapsed ? 'w-16' : 'w-64'}`}>
            {/* Logo */}
            <div className="h-[60px] border-b border-border relative flex items-center px-4 md:px-4">
                {!isCollapsed && (
                    <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9 overflow-hidden rounded-lg">
                            <Image
                                src="/brand/logotipoacademy.png"
                                alt="CleverX Academy"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div className="flex flex-col -space-y-1">
                            <span className="text-xl font-bold text-foreground tracking-tight">CleverX</span>
                            <span className="text-[10px] font-medium text-muted uppercase tracking-[0.2em] ml-0.5">Academy</span>
                        </div>
                    </div>
                )}
                {isCollapsed && (
                    <div className="w-full flex items-center justify-center">
                        <div className="relative h-8 w-8 overflow-hidden rounded-lg">
                            <Image
                                src="/brand/logotipoacademy.png"
                                alt="CleverX Academy"
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>
                )}

                {/* Toggle Button - Positioned exactly on the border line */}
                <button
                    onClick={toggleSidebar}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-border bg-hover-bg hover:bg-background transition-colors flex items-center justify-center shadow-sm z-[999]"
                    title={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                >
                    {isCollapsed ? (
                        <ChevronRight size={14} className="text-foreground" />
                    ) : (
                        <ChevronLeft size={14} className="text-foreground" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 transition-all overflow-y-auto overflow-x-visible ${isCollapsed ? 'px-2 py-4' : 'p-4'}`}>
                <ul className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        const linkContent = (
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
            </nav>

            {/* User Section */}
            <div className={`border-t border-border relative transition-all ${isCollapsed ? 'p-2' : 'p-4'}`} ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`w-full flex items-center gap-3 rounded-lg hover:bg-hover-bg transition-colors ${isCollapsed ? 'justify-center py-2' : 'px-4 py-3'}`}
                    title={isCollapsed ? userName : ''}
                >
                    <div className={`rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary border border-primary/20 flex-shrink-0 ${isCollapsed ? 'h-8 w-8' : 'h-9 w-9'}`}>
                        {userName.charAt(0).toUpperCase()}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                            <p className="text-xs text-muted truncate">{userEmail}</p>
                        </div>
                    )}
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                    <div className={`absolute bottom-full mb-2 rounded-lg border border-border bg-card-bg shadow-lg overflow-hidden z-50 ${isCollapsed ? 'left-full ml-2 w-56' : 'left-4 right-4'}`}>
                        {/* User Info Header */}
                        <div className="px-4 py-3 border-b border-border">
                            <p className="text-base font-medium text-foreground">{userName}</p>
                            <p className="text-sm text-muted">{userEmail}</p>
                        </div>

                        {/* Menu Items */}
                        <div className="py-1">
                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors">
                                <User size={20} />
                                <span>Mi perfil</span>
                            </button>

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
                            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-hover-bg transition-colors">
                                <LogOut size={20} />
                                <span>Cerrar sesión</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
