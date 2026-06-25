'use client';

import { useSidebar } from '@/components/sidebar-context';
import { Menu } from 'lucide-react';

export function MobileMenuButton() {
    const { setIsMobileOpen } = useSidebar();

    return (
        <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground flex items-center justify-center"
            title="Abrir menú"
        >
            <Menu size={20} />
        </button>
    );
}
