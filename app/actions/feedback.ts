'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

async function getCurrentUser() {
    const token = await convexAuthNextjsToken();
    if (!token) return null;
    
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );
    
    return currentUser;
}

export async function submitLessonFeedback({
    lessonId,
    bootcampId,
    isLiked,
    comment
}: {
    lessonId: number | string;
    bootcampId: number | string;
    isLiked?: boolean | null;
    comment?: string | null;
}) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('Usuario no autenticado.');

    const supabase = await createClient();

    console.log('[submitLessonFeedback] Guardando feedback:', { 
        lessonId, 
        bootcampId, 
        isLiked, 
        comment, 
        userId: currentUser.email 
    });

    // Upsert the feedback record
    const { data, error } = await supabase
        .from('LessonFeedback')
        .upsert({
            lessonId,
            userId: currentUser.email,
            isLiked,
            comment,
            createdAt: Date.now(),
        }, {
            onConflict: 'lessonId,userId'
        })
        .select();

    console.log('[submitLessonFeedback] Resultado:', { data, error });

    if (error) {
        console.error('Error submitting feedback:', error);
        throw new Error('No se pudo guardar el feedback: ' + error.message);
    }

    revalidatePath(`/dashboard/bootcamp/${bootcampId}/clase/${lessonId}`);
    return { success: true };
}

export async function getAllLessonFeedback() {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('No autorizado');
    
    if (currentUser.role !== 'superadmin' && currentUser.role !== 'docente') {
        throw new Error('No tienes permisos suficientes.');
    }

    const supabase = await createClient();
    
    // Get all feedback
    const { data: feedbacks, error } = await supabase
        .from('LessonFeedback')
        .select('*')
        .order('createdAt', { ascending: false });

    console.log('[getAllLessonFeedback] Feedbacks encontrados:', feedbacks?.length || 0);

    if (error) {
        console.error('Error fetching all feedback:', error);
        return [];
    }

    if (!feedbacks || feedbacks.length === 0) return [];

    // Get unique lesson IDs
    const lessonIds = [...new Set((feedbacks as any[]).map((f: any) => f.lessonId))];
    
    console.log('[getAllLessonFeedback] Lesson IDs únicos:', lessonIds);
    
    // Get lessons from Convex (not Supabase)
    const { data: lessons } = await supabase
        .from('Lesson')
        .select('id, _id, title, moduleId')
        .in('id', lessonIds);
    
    console.log('[getAllLessonFeedback] Lessons encontradas:', lessons?.length || 0);
    
    // Create lessons map with both id and _id as keys
    const lessonMap: Record<string, any> = {};
    const moduleIds: string[] = [];
    for (const les of (lessons || []) as any[]) {
        if (les.id) lessonMap[String(les.id)] = les;
        if (les._id) lessonMap[String(les._id)] = les;
        if (les.moduleId) moduleIds.push(les.moduleId);
    }
    
    // Get unique modules
    const uniqueModuleIds = [...new Set(moduleIds)];
    let moduleMap: Record<string, any> = {};
    let bootcampMap: Record<string, any> = {};
    
    if (uniqueModuleIds.length > 0) {
        const { data: modules } = await supabase
            .from('Module')
            .select('id, _id, title, bootcampId')
            .in('id', uniqueModuleIds);
        
        const bootcampIds: string[] = [];
        for (const mod of (modules || []) as any[]) {
            if (mod.id) moduleMap[String(mod.id)] = mod;
            if (mod._id) moduleMap[String(mod._id)] = mod;
            if (mod.bootcampId) bootcampIds.push(mod.bootcampId);
        }
        
        // Get unique bootcamps
        const uniqueBootcampIds = [...new Set(bootcampIds)];
        if (uniqueBootcampIds.length > 0) {
            const { data: bootcamps } = await supabase
                .from('Bootcamp')
                .select('id, _id, title')
                .in('id', uniqueBootcampIds);
            
            for (const bc of (bootcamps || []) as any[]) {
                if (bc.id) bootcampMap[String(bc.id)] = bc;
                if (bc._id) bootcampMap[String(bc._id)] = bc;
            }
        }
    }

    // Build the response with nested structure
    return (feedbacks as any[]).map((f: any) => {
        const lessonIdStr = String(f.lessonId);
        const lesson = lessonMap[lessonIdStr];
        const moduleIdStr = lesson?.moduleId ? String(lesson.moduleId) : null;
        const module = moduleIdStr ? moduleMap[moduleIdStr] : null;
        const bootcampIdStr = module?.bootcampId ? String(module.bootcampId) : null;
        const bootcamp = bootcampIdStr ? bootcampMap[bootcampIdStr] : null;
        
        return {
            ...f,
            Lesson: lesson ? {
                title: lesson.title,
                Module: module ? {
                    title: module.title,
                    Bootcamp: bootcamp ? {
                        title: bootcamp.title
                    } : null
                } : null
            } : null,
            User: {
                email: f.userId,
                id: f.userId
            }
        };
    });
}

export async function getLessonFeedback(lessonId: number | string) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('LessonFeedback')
        .select('*')
        .eq('lessonId', lessonId)
        .eq('userId', currentUser.email)
        .maybeSingle();

    if (error) {
        console.error('Error getting feedback:', error);
        return null;
    }

    return data;
}
