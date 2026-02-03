'use client';

import { useState, useEffect, useCallback } from 'react';

export function useBootcampProgress(bootcampId: number) {
    const [completedClassIds, setCompletedClassIds] = useState<number[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Run only on client
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`bootcamp_progress_${bootcampId}`);
            if (saved) {
                try {
                    setCompletedClassIds(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse progress", e);
                }
            }
            setIsLoaded(true);
        }
    }, [bootcampId]);

    const toggleClassCompletion = useCallback((classId: number) => {
        setCompletedClassIds(prev => {
            const exists = prev.includes(classId);
            const next = exists
                ? prev.filter(id => id !== classId)
                : [...prev, classId];

            localStorage.setItem(`bootcamp_progress_${bootcampId}`, JSON.stringify(next));
            return next;
        });
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
