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

export async function reorderLessons(bootcampId: number, lessonOrders: { id: number, order: number }[]) {
    const supabase = await createClient();
    
    // Since we want to update only the 'order' column for multiple rows,
    // we can use multiple update calls. For a small number of lessons, this is fine.
    // If it becomes a bottleneck, a custom RPC would be better.
    for (const item of lessonOrders) {
        await supabase
            .from('Lesson')
            .update({ order: item.order })
            .eq('id', item.id);
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    revalidatePath(`/dashboard/bootcamp/${bootcampId}`);
}

export async function reorderModules(bootcampId: number, moduleOrders: { id: number, order: number }[]) {
    const supabase = await createClient();
    
    for (const item of moduleOrders) {
        await supabase
            .from('Module')
            .update({ order: item.order })
            .eq('id', item.id);
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    revalidatePath(`/dashboard/bootcamp/${bootcampId}`);
}

export async function getBootcampCurriculum(bootcampId: number) {
    const supabase = await createClient();

    const { data: modules, error } = await supabase
        .from('Module')
        .select(`
            id,
            title,
            order,
            lessons:Lesson (
                id,
                title,
                type,
                content,
                order
            )
        `)
        .eq('bootcampId', bootcampId)
        .order('order', { ascending: true });

    if (error) {
        console.error('Error fetching curriculum:', error);
        return [];
    }

    // Sort lessons by Order
    modules.forEach(m => {
        if (m.lessons) {
            (m.lessons as any[]).sort((a, b) => (a.order || 0) - (b.order || 0));
        }
    });

    return modules;
}
