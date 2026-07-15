'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getMasterclass(bootcampId: number) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('Masterclass')
        .select('*')
        .eq('bootcampId', bootcampId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching masterclass:', error);
        return null;
    }
    return data;
}

export async function saveMasterclass(bootcampId: number, updates: { videoUrl?: string | null; description?: string | null; materials?: { name: string; url: string }[] }) {
    const supabase = await createClient();
    
    // Auth & Role check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: roleRow } = await supabase.from('UserRole').select('role').eq('id', user.id).maybeSingle();
    if (roleRow?.role !== 'docente' && roleRow?.role !== 'superadmin') {
        throw new Error('No autorizado');
    }

    // Try to fetch existing record
    const { data: existing } = await supabase
        .from('Masterclass')
        .select('id')
        .eq('bootcampId', bootcampId)
        .maybeSingle();

    let error;
    if (existing) {
        const { error: updateError } = await supabase
            .from('Masterclass')
            .update({
                videoUrl: updates.videoUrl,
                description: updates.description,
                materials: updates.materials,
                updatedAt: new Date().toISOString()
            })
            .eq('bootcampId', bootcampId);
        error = updateError;
    } else {
        const { error: insertError } = await supabase
            .from('Masterclass')
            .insert({
                bootcampId,
                videoUrl: updates.videoUrl,
                description: updates.description,
                materials: updates.materials
            });
        error = insertError;
    }

    if (error) {
        console.error('Error saving masterclass:', error);
        throw new Error('Error al guardar la masterclass');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    revalidatePath(`/dashboard/bootcamp/${bootcampId}`);
    revalidatePath(`/dashboard/bootcamp/${bootcampId}/masterclass`);
    return { success: true };
}
