'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMyCompletions, toggleLessonCompletion } from '@/app/actions/student';

export function useBootcampProgress(bootcampId: number) {
    const [completedClassIds, setCompletedClassIds] = useState<number[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        async function loadProgress() {
            // 1. Initial load from localStorage for speed
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem(`bootcamp_progress_${bootcampId}`);
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        setCompletedClassIds(parsed);
                    } catch (e) {
                        console.error("Failed to parse progress", e);
                    }
                }
            }

            // 2. Sync with DB
            try {
                const dbCompletions = await getMyCompletions(bootcampId);
                if (dbCompletions && dbCompletions.length > 0) {
                    setCompletedClassIds(dbCompletions);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(`bootcamp_progress_${bootcampId}`, JSON.stringify(dbCompletions));
                    }
                }
            } catch (error) {
                console.error("Error syncing progress with database:", error);
            } finally {
                setIsLoaded(true);
            }
        }

        loadProgress();
    }, [bootcampId]);

    const toggleClassCompletion = useCallback(async (classId: number) => {
        // Optimistic update local state & storage
        setCompletedClassIds(prev => {
            const exists = prev.includes(classId);
            const next = exists
                ? prev.filter(id => id !== classId)
                : [...prev, classId];

            if (typeof window !== 'undefined') {
                localStorage.setItem(`bootcamp_progress_${bootcampId}`, JSON.stringify(next));
            }
            return next;
        });

        // Sync with DB
        try {
            await toggleLessonCompletion(bootcampId, classId);
        } catch (error) {
            console.error("Failed to sync completion with DB:", error);
        }
    }, [bootcampId]);

    const isCompleted = useCallback((classId: number) => completedClassIds.includes(classId), [completedClassIds]);

    const getProgressPercentage = useCallback((lessons: { id: number; type?: string; content?: string }[]) => {
        const filteredLessons = lessons.filter(l => l.type !== 'subtitle');
        if (filteredLessons.length === 0) return 0;
        
        let totalWeight = 0;
        let completedWeight = 0;
        
        filteredLessons.forEach(l => {
            let weight = 1;
            if (l.type === 'check') {
                try {
                    const parsed = JSON.parse(l.content || '{}');
                    weight = Number(parsed.value) || 1;
                } catch {}
            }
            totalWeight += weight;
            if (completedClassIds.includes(l.id)) {
                completedWeight += weight;
            }
        });
        
        return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    }, [completedClassIds]);

    return {
        completedClassIds,
        isCompleted,
        toggleClassCompletion,
        getProgressPercentage,
        isLoaded
    };
}
