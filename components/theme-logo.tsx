'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

interface ThemeLogoProps {
    className?: string;
}

export function ThemeLogo({ className }: ThemeLogoProps) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const src = mounted && resolvedTheme === 'light' 
        ? "/brand/logotipo-synaptia-vertical-light.png" 
        : "/brand/logotipo-synaptia-vertical-dark.png";

    return (
        <Image
            src={src}
            alt="Synaptia"
            fill
            className={`object-contain object-left ${className || ''}`}
        />
    );
}
