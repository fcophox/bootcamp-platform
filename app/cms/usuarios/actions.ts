'use server';

import { createClient } from '@/utils/supabase/server';
import { api } from '@/convex/_generated/api';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchMutation } from 'convex/nextjs';
import { revalidatePath } from 'next/cache';

type BootcampOption = {
    id: string;
    title: string;
    icon?: string;
};

async function requireSuperadmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.user_metadata?.role !== 'superadmin') {
        return { supabase, error: 'No autorizado' };
    }

    return { supabase, error: null };
}

export async function deleteUser(userId: string, email: string) {
    const token = await convexAuthNextjsToken();
    if (!token) return { error: 'No autorizado' };

    try {
        await fetchMutation(api.users.deleteUserEverywhere, { userId, email }, { token });
        revalidatePath('/cms/usuarios');
        return { success: true };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'No se pudo eliminar el usuario.' };
    }
}

export async function updateUserRole(userId: string, newRole: 'alumno' | 'docente' | 'superadmin') {
    const supabase = await createClient();
    
    const { error } = await supabase
        .from('UserRole')
        .update({ role: newRole })
        .eq('id', userId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/cms/usuarios');
    return { success: true };
}

export async function getAssignableBootcamps(): Promise<{ bootcamps: BootcampOption[] } | { error: string }> {
    const { supabase, error: authError } = await requireSuperadmin();
    if (authError) return { error: authError };

    const { data, error } = await supabase
        .from('Bootcamp')
        .select('id, title, icon')
        .order('title', { ascending: true });

    if (error) {
        return { error: error.message || 'No se pudieron cargar los bootcamps.' };
    }

    return {
        bootcamps: ((data as any[]) || []).map((bootcamp) => ({
            id: String(bootcamp.id),
            title: bootcamp.title || 'Bootcamp',
            icon: bootcamp.icon,
        })),
    };
}

export async function associateUserToBootcamp(userId: string, email: string, bootcampId: string) {
    const { supabase, error: authError } = await requireSuperadmin();
    if (authError) return { error: authError };

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !bootcampId) {
        return { error: 'Selecciona un usuario y un bootcamp válidos.' };
    }

    const { data: existing, error: existingError } = await supabase
        .from('BootcampStudent')
        .select('id')
        .eq('bootcampId', bootcampId)
        .eq('email', normalizedEmail)
        .maybeSingle();

    if (existingError) {
        return { error: existingError.message || 'No se pudo validar la asociación existente.' };
    }

    if (existing) {
        return { error: 'Este usuario ya está asociado a ese bootcamp.' };
    }

    const { error } = await supabase
        .from('BootcampStudent')
        .insert({
            bootcampId,
            userId,
            email: normalizedEmail,
            name: normalizedEmail.split('@')[0],
            status: 'invited',
            invitedAt: Date.now(),
            enrolledAt: Date.now(),
        });

    if (error) {
        return { error: error.message || 'No se pudo asociar el usuario al bootcamp.' };
    }

    revalidatePath('/cms/usuarios');
    return { success: true };
}
