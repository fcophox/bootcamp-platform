'use client';

import { useEffect } from 'react';
import { isProdEnv } from '@/utils/env';

// Microsoft Clarity session recording/heatmaps — production traffic only, so
// dev testing never pollutes real user metrics. Project ID isn't a secret
// (it's embedded in every page's HTML for any visitor to see), but it's still
// configurable via env instead of hardcoded so it isn't baked in for dev/local
// builds at all.
export function ClarityAnalytics() {
    useEffect(() => {
        const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
        if (!isProdEnv() || !projectId) return;

        // Load Clarity script dynamically to avoid SSR issues
        const loadClarity = async () => {
            try {
                const Clarity = await import('@microsoft/clarity');
                Clarity.default.init(projectId);
            } catch (error) {
                console.warn('Failed to load Microsoft Clarity:', error);
            }
        };
        loadClarity();
    }, []);

    return null;
}
