'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMyCompletions, toggleLessonCompletion } from '@/app/actions/student';

export function useBootcampProgress(bootcampId: number | string) {
    // Store IDs as strings to handle both numeric and Convex string IDs
    const [completedClassIds, setCompletedClassIds] = useState<(number | string)[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    
    // Normalize bootcampId for localStorage key (use string representation)
    const storageKey = `bootcamp_progress_${bootcampId}`;

    useEffect(() => {
        async function loadProgress() {
            // 1. Initial load from localStorage for speed
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem(storageKey);
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
                        localStorage.setItem(storageKey, JSON.stringify(dbCompletions));
                    }
                }
            } catch (error) {
                console.error("Error syncing progress with database:", error);
            } finally {
                setIsLoaded(true);
            }
        }

        loadProgress();
    }, [bootcampId, storageKey]);

    const toggleClassCompletion = useCallback(async (classId: number | string) => {
        // Optimistic update local state & storage
        setCompletedClassIds(prev => {
            // Compare as strings for consistency
            const classIdStr = String(classId);
            const exists = prev.some(id => String(id) === classIdStr);
            const next = exists
                ? prev.filter(id => String(id) !== classIdStr)
                : [...prev, classId];

            if (typeof window !== 'undefined') {
                localStorage.setItem(storageKey, JSON.stringify(next));
            }
            return next;
        });

        // Sync with DB - pass ID directly (can be numeric or Convex string ID)
        try {
            await toggleLessonCompletion(bootcampId, classId);
        } catch (error) {
            console.error("Failed to sync completion with DB:", error);
        }
    }, [bootcampId, storageKey]);

    const isCompleted = useCallback((classId: number | string) => {
        const classIdStr = String(classId);
        return completedClassIds.some(id => String(id) === classIdStr);
    }, [completedClassIds]);

    const getProgressPercentage = useCallback((lessons: { id: number | string; type?: string; content?: string }[]) => {
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
            const lessonIdStr = String(l.id);
            if (completedClassIds.some(id => String(id) === lessonIdStr)) {
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
