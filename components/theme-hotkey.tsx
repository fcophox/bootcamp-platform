"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeHotkey() {
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                setTheme(theme === 'dark' ? 'light' : 'dark');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [theme, setTheme]);

    return null;
}
