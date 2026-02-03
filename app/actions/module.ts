'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createModule(bootcampId: number, title: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Module')
        .insert({
            bootcampId,
            title,
            order: 0, // Should calculate max order + 1 ideally
        });

    if (error) {
        console.error('Error creating module:', error);
        throw new Error('Error al crear el módulo');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function createLesson(moduleId: number, bootcampId: number, title: string, type: string, content: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Lesson')
        .insert({
            moduleId,
            title,
            type,
            content,
            order: 0,
        });

    if (error) {
        console.error('Error creating lesson:', error);
        throw new Error('Error al crear la lección');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    revalidatePath(`/dashboard/bootcamp/${bootcampId}`);
}

export async function updateLesson(lessonId: number, bootcampId: number, title: string, type: string, content: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Lesson')
        .update({
            title,
            type,
            content
        })
        .eq('id', lessonId);

    if (error) {
        console.error('Error updating lesson:', error);
        throw new Error('Error al actualizar la lección');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    revalidatePath(`/dashboard/bootcamp/${bootcampId}`);
    revalidatePath(`/dashboard/bootcamp/${bootcampId}/clase/${lessonId}`);
}

export async function updateModule(moduleId: number, bootcampId: number, title: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Module')
        .update({
            title,
        })
        .eq('id', moduleId);

    if (error) {
        console.error('Error updating module:', error);
        throw new Error('Error al actualizar el módulo');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function deleteModule(id: number, bootcampId: number) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Module')
        .delete()
        .eq('id', id);

    if (error) throw error;
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function deleteLesson(id: number, bootcampId: number) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Lesson')
        .delete()
        .eq('id', id);

    if (error) throw error;
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function getBootcampCurriculum(bootcampId: number) {
    const supabase = await createClient();

    const { data: modules, error } = await supabase
        .from('Module')
        .select(`
            id,
            title,
            lessons:Lesson (
                id,
                title,
                type,
                content,
                order
            )
        `)
        .eq('bootcampId', bootcampId)
        .order('id', { ascending: true }); // Should ideally order by 'order' column

    if (error) {
        console.error('Error fetching curriculum:', error);
        return [];
    }

    // Sort lessons by ID or Order if avail
    modules.forEach(m => {
        if (m.lessons) {
            // @ts-ignore
            m.lessons.sort((a, b) => a.id - b.id);
        }
    });

    return modules;
}
