'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function createModule(bootcampId: number | string, title: string) {
    const supabase = await createClient();

    // Get max order
    const { data: maxModule } = await supabase
        .from('Module')
        .select('order')
        .eq('bootcampId', bootcampId)
        .order('order', { ascending: false })
        .limit(1)
        .single();

    const newOrder = maxModule ? (maxModule.order || 0) + 1 : 0;

    const { error } = await supabase
        .from('Module')
        .insert({
            bootcampId,
            title,
            order: newOrder,
        });

    if (error) {
        console.error('Error creating module:', error);
        throw new Error('Error al crear el módulo');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function createLesson(moduleId: number | string, bootcampId: number | string, title: string, type: string, content: string) {
    const supabase = await createClient();

    // Get max order
    const { data: maxLesson } = await supabase
        .from('Lesson')
        .select('order')
        .eq('moduleId', moduleId)
        .order('order', { ascending: false })
        .limit(1)
        .single();

    const newOrder = maxLesson ? (maxLesson.order || 0) + 1 : 0;

    const { error } = await supabase
        .from('Lesson')
        .insert({
            moduleId,
            title,
            type,
            content,
            order: newOrder,
        });

    if (error) {
        console.error('Error creating lesson:', error);
        throw new Error('Error al crear la lección');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    revalidatePath(`/dashboard/bootcamp/${bootcampId}`);
}

export async function updateLesson(lessonId: number | string, bootcampId: number | string, title: string, type: string, content: string) {
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

export async function updateModule(moduleId: number | string, bootcampId: number | string, title: string) {
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

export async function deleteModule(id: number | string, bootcampId: number | string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Module')
        .delete()
        .eq('id', id);

    if (error) throw error;
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function deleteLesson(id: number | string, bootcampId: number | string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Lesson')
        .delete()
        .eq('id', id);

    if (error) throw error;
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function reorderLessons(bootcampId: number | string, lessonOrders: { id: number | string, order: number }[]) {
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

export async function reorderModules(bootcampId: number | string, moduleOrders: { id: number | string, order: number }[]) {
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

export async function getBootcampCurriculum(bootcampId: number | string) {
    // Use Convex query that handles both legacyId (number) and convexId (string)
    const numericId = typeof bootcampId === 'string' ? parseInt(bootcampId, 10) : bootcampId;
    const isNumeric = !isNaN(numericId);
    
    const bootcamp = await fetchQuery(api.bootcamps.getWithModulesAndLessons, 
        isNumeric 
            ? { legacyId: numericId }
            : { convexId: String(bootcampId) }
    );
    
    if (!bootcamp) {
        return [];
    }
    
    // Return modules with lessons in the expected format
    return bootcamp.modules.map(m => ({
        id: m.id,
        title: m.title,
        order: m.order,
        lessons: m.lessons.map(l => ({
            id: l.id,
            title: l.title,
            type: l.type,
            content: l.content,
            order: l.order,
        }))
    }));
}
