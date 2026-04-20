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

    const getProgressPercentage = useCallback((totalClasses: number) => {
        if (!totalClasses || totalClasses === 0) return 0;
        return Math.round((completedClassIds.length / totalClasses) * 100);
    }, [completedClassIds]);

    return {
        completedClassIds,
        isCompleted,
        toggleClassCompletion,
        getProgressPercentage,
        isLoaded
    };
}
