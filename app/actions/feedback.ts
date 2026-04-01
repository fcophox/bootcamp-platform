'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function submitLessonFeedback({
    lessonId,
    bootcampId,
    isLiked,
    comment
}: {
    lessonId: number;
    bootcampId: number;
    isLiked?: boolean | null;
    comment?: string | null;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado.');

    // Upsert the feedback record
    const { error } = await supabase
        .from('LessonFeedback')
        .upsert({
            lessonId,
            userId: user.id,
            isLiked,
            comment,
        }, {
            onConflict: 'lessonId,userId'
        });

    if (error) {
        console.error('Error submitting feedback:', error);
        throw new Error('No se pudo guardar el feedback.');
    }

    revalidatePath(`/dashboard/bootcamp/${bootcampId}/clase/${lessonId}`);
    return { success: true };
}

export async function getAllLessonFeedback() {
    const supabase = await createClient();
    
    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autorizado');

    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (!roleData || (roleData.role !== 'superadmin' && roleData.role !== 'docente')) {
        throw new Error('No tienes permisos suficientes.');
    }

    const { data, error } = await supabase
        .from('LessonFeedback')
        .select(`
            *,
            Lesson:lessonId (
                title,
                Module:moduleId (
                    title,
                    Bootcamp:bootcampId (
                        title
                    )
                )
            ),
            User:userId (
                email,
                id
            )
        `)
        .order('createdAt', { ascending: false });

    if (error) {
        console.error('Error fetching all feedback:', error);
        return [];
    }

    return data;
}

export async function getLessonFeedback(lessonId: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('LessonFeedback')
        .select('*')
        .eq('lessonId', lessonId)
        .eq('userId', user.id)
        .maybeSingle();

    if (error) {
        console.error('Error getting feedback:', error);
        return null;
    }

    return data;
}
