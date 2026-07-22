'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

export async function getMasterclass(bootcampId: number | string) {
    const supabase = await createClient();
    
    // First try with the provided ID
    let { data, error } = await supabase
        .from('Masterclass')
        .select('*')
        .eq('bootcampId', bootcampId)
        .maybeSingle();

    // If not found and bootcampId looks like a Convex ID (non-numeric string),
    // we need to get the bootcamp's legacyId first
    if (!data && typeof bootcampId === 'string' && isNaN(parseInt(bootcampId, 10))) {
        // Try to get the bootcamp to find its legacyId
        const { data: bootcamp } = await supabase
            .from('Bootcamp')
            .select('id')
            .eq('_id', bootcampId)
            .maybeSingle();
        
        if (bootcamp?.id) {
            const result = await supabase
                .from('Masterclass')
                .select('*')
                .eq('bootcampId', bootcamp.id)
                .maybeSingle();
            data = result.data;
            error = result.error;
        }
    }

    if (error) {
        console.error('Error fetching masterclass:', error);
        return null;
    }
    return data;
}

export async function saveMasterclass(bootcampId: number | string, updates: { videoUrl?: string | null; description?: string | null; materials?: { name: string; url: string }[] }) {
    const token = await convexAuthNextjsToken();
    if (!token) throw new Error('No autenticado');

    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser) throw new Error('No autenticado');
    
    if (currentUser.role !== 'docente' && currentUser.role !== 'superadmin') {
        throw new Error('No autorizado');
    }

    const supabase = await createClient();
    
    // Resolve the numeric bootcampId for Supabase
    let numericBootcampId: number | null = null;
    
    if (typeof bootcampId === 'number') {
        numericBootcampId = bootcampId;
    } else {
        const parsed = parseInt(bootcampId, 10);
        if (!isNaN(parsed) && String(parsed) === bootcampId) {
            numericBootcampId = parsed;
        } else {
            // It's a Convex ID, try to get the bootcamp's legacyId
            const { data: bootcamp } = await supabase
                .from('Bootcamp')
                .select('id')
                .eq('_id', bootcampId)
                .maybeSingle();
            
            if (bootcamp?.id) {
                numericBootcampId = bootcamp.id;
            }
        }
    }
    
    if (!numericBootcampId) {
        throw new Error('No se pudo resolver el ID del bootcamp');
    }

    // Try to fetch existing record
    const { data: existing } = await supabase
        .from('Masterclass')
        .select('id')
        .eq('bootcampId', numericBootcampId)
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
            .eq('bootcampId', numericBootcampId);
        error = updateError;
    } else {
        const { error: insertError } = await supabase
            .from('Masterclass')
            .insert({
                bootcampId: numericBootcampId,
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
