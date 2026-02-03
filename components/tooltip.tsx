'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: string;
    children: ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, side = 'right' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line
        setMounted(true);
    }, []);

    const updatePosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            let top = 0;
            let left = 0;

            // Margen entre el elemento y el tooltip
            const gap = 12;

            switch (side) {
                case 'right':
                    top = rect.top + rect.height / 2;
                    left = rect.right + gap;
                    break;
                case 'left':
                    top = rect.top + rect.height / 2;
                    left = rect.left - gap;
                    break;
                case 'top':
                    top = rect.top - gap;
                    left = rect.left + rect.width / 2;
                    break;
                case 'bottom':
                    top = rect.bottom + gap;
                    left = rect.left + rect.width / 2;
                    break;
            }
            setCoords({ top, left });
        }
    };

    const handleMouseEnter = () => {
        updatePosition();
        setIsVisible(true);
    };

    // Clases para ajustar la posición del tooltip relativo a las coordenadas calculadas
    // Usamos transform para centrarlo o moverlo según el lado
    const transformClasses = {
        right: '-translate-y-1/2',
        left: '-translate-x-100 -translate-y-1/2',
        top: '-translate-x-1/2 -translate-y-100',
        bottom: '-translate-x-1/2'
    };

    // Clases para la flecha
    const arrowClasses = {
        right: '-left-1 top-1/2 -translate-y-1/2',
        left: '-right-1 top-1/2 -translate-y-1/2',
        top: 'bottom-[-4px] left-1/2 -translate-x-1/2',
        bottom: 'top-[-4px] left-1/2 -translate-x-1/2'
    };

    return (
        <div
            ref={triggerRef}
            className="relative block w-full"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {mounted && isVisible && createPortal(
                <div
                    className={`fixed z-[9999] px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap pointer-events-none transform ${transformClasses[side]}`}
                    style={{
                        top: coords.top,
                        left: coords.left,
                    }}
                >
                    {content}
                    {/* Flecha */}
                    <div
                        className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${arrowClasses[side]}`}
                    />
                </div>,
                document.body
            )}
        </div>
    );
}
