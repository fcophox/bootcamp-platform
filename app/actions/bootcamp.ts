'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';



export async function createBootcamp(formData: FormData) {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const duration = formData.get('duration') as string;
    const level = formData.get('level') as string;
    const startDate = formData.get('startDate') as string;
    const icon = formData.get('icon') as string || 'code';
    const color = formData.get('color') as string || 'green';
    const enableChecklist = formData.get('enableChecklist') !== 'false'; // Defaults to true unless explicitly 'false'
    const enableRanking = formData.get('enableRanking') !== 'false'; // Defaults to true unless explicitly 'false'
    const imageUrl = formData.get('imageUrl') as string || null;

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
            enableChecklist,
            enableRanking,
            imageUrl,
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

export async function updateBootcamp(id: number, updates: { title?: string; icon?: string; color?: string; description?: string; duration?: string; level?: string; startDate?: string; enableChecklist?: boolean; enableRanking?: boolean; imageUrl?: string | null }) {

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
    revalidatePath(`/dashboard/bootcamp/${id}`);
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
        .order('order', { foreignTable: 'Module', ascending: true })
        .order('order', { foreignTable: 'Module.Lesson', ascending: true })
        .single();

    if (error) {
        console.error('Error fetching bootcamp:', error);
        return null;
    }
    return data;
}

export async function cloneBootcamp(id: number) {
    const supabase = await createClient();

    // 1. Authenticate and authorize
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('No autorizado');
    }

    // Get role
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    const role = roleData?.role || 'alumno';
    if (role === 'alumno') {
        throw new Error('No tienes permisos para clonar este bootcamp');
    }

    // 2. Fetch original bootcamp
    const { data: originalBootcamp, error: fetchError } = await supabase
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
                    content,
                    order
                )
            )
        `)
        .eq('id', id)
        .single();

    if (fetchError || !originalBootcamp) {
        console.error('Error fetching bootcamp to clone:', fetchError);
        throw new Error('No se pudo encontrar el bootcamp original');
    }

    // 3. Create unique slug
    const slug = `${originalBootcamp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-copia-${Date.now()}`;

    // 4. Create cloned bootcamp record
    const { data: newBootcamp, error: insertError } = await supabase
        .from('Bootcamp')
        .insert({
            title: `${originalBootcamp.title} (Copia)`,
            description: originalBootcamp.description || '',
            duration: originalBootcamp.duration || '',
            level: originalBootcamp.level || 'Principiante',
            startDate: originalBootcamp.startDate || new Date().toISOString().split('T')[0],
            students: 0,
            icon: originalBootcamp.icon || 'code',
            color: originalBootcamp.color || 'green',
            enableChecklist: originalBootcamp.enableChecklist ?? true,
            enableRanking: originalBootcamp.enableRanking ?? true,
            imageUrl: originalBootcamp.imageUrl || null,
            slug,
            updatedAt: new Date().toISOString()
        })
        .select()
        .single();

    if (insertError || !newBootcamp) {
        console.error('Error inserting cloned bootcamp:', insertError);
        throw new Error('Error al crear la copia del bootcamp');
    }

    // 5. If the user is a docente, automatically enroll them as 'active' (or just general association)
    // so they can see and manage it
    if (role === 'docente') {
        const { error: enrollError } = await supabase
            .from('BootcampStudent')
            .insert({
                bootcampId: newBootcamp.id,
                email: user.email || '',
                status: 'active',
                joinedAt: new Date().toISOString()
            });

        if (enrollError) {
            console.error('Error enrolling docente in cloned bootcamp:', enrollError);
        }
    }

    // 6. Clone modules and lessons
    if (originalBootcamp.modules && originalBootcamp.modules.length > 0) {
        // Sort modules by order
        const sortedModules = [...originalBootcamp.modules].sort((a, b) => (a.order || 0) - (b.order || 0));

        for (const mod of sortedModules) {
            const { data: newModule, error: modError } = await supabase
                .from('Module')
                .insert({
                    bootcampId: newBootcamp.id,
                    title: mod.title,
                    order: mod.order
                })
                .select()
                .single();

            if (modError || !newModule) {
                console.error('Error cloning module:', modError);
                throw new Error(`Error al clonar el módulo: ${mod.title}`);
            }

            if (mod.lessons && mod.lessons.length > 0) {
                const sortedLessons = [...mod.lessons].sort((a, b) => (a.order || 0) - (b.order || 0));
                const lessonsToInsert = sortedLessons.map(les => ({
                    moduleId: newModule.id,
                    title: les.title,
                    type: les.type,
                    content: les.content || '',
                    order: les.order
                }));

                const { error: lesError } = await supabase
                    .from('Lesson')
                    .insert(lessonsToInsert);

                if (lesError) {
                    console.error('Error cloning lessons:', lesError);
                    throw new Error(`Error al clonar las lecciones del módulo: ${mod.title}`);
                }
            }
        }
    }

    // 7. Revalidate cache
    revalidatePath('/cms');
    revalidatePath('/dashboard');

    return { success: true, newBootcampId: newBootcamp.id };
}

