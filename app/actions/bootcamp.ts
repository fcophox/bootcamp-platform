'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export async function createBootcamp(formData: FormData) {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const duration = formData.get('duration') as string;
    const level = formData.get('level') as string;
    const startDate = formData.get('startDate') as string;
    const icon = formData.get('icon') as string || 'code';
    const color = formData.get('color') as string || 'green';

    if (!title || !description || !duration || !level || !startDate) {
        throw new Error('Todos los campos son obligatorios');
    }

    const supabase = await createClient();

    // Check for existing slug and append suffix if needed could be added here, 
    // but for now relying on database unique constraint to throw error or just basic slug.

    const { data: bootcamp, error } = await supabase
        .from('Bootcamp')
        .insert({
            title,
            description,
            duration,
            level,
            startDate,
            students: 0,
            icon,
            color,
            updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating bootcamp:', error);
        throw new Error('Error al crear el bootcamp');
    }

    revalidatePath('/dashboard');
    redirect(`/cms/bootcamp/${bootcamp.id}/manage`);
}

export async function deleteBootcamp(id: number) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Bootcamp')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting bootcamp:', error);
        throw new Error('Error al eliminar el bootcamp');
    }

    revalidatePath('/dashboard');
    revalidatePath('/cms');
    revalidatePath('/cms');
}

export async function updateBootcamp(id: number, updates: { title?: string; icon?: string; color?: string }) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('Bootcamp')
        .update({ ...updates, updatedAt: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error updating bootcamp:', error);
        throw new Error('Error al actualizar el bootcamp');
    }

    revalidatePath(`/cms/bootcamp/${id}/manage`);
    revalidatePath('/dashboard');
    revalidatePath('/cms');
}

export async function getBootcamp(id: number) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('Bootcamp')
        .select(`
            *,
            modules:Module (
                id,
                title,
                order,
                lessons:Lesson (
                    id,
                    title,
                    type,
                    order
                )
            )
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching bootcamp:', error);
        return null;
    }
    return data;
}
