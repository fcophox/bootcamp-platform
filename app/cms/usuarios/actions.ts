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
    const { error: authError } = await requireSuperadmin();
    if (authError) return { error: authError };

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !bootcampId) {
        return { error: 'Selecciona un usuario y un bootcamp válidos.' };
    }

    const token = await convexAuthNextjsToken();
    if (!token) return { error: 'No autorizado' };

    try {
        const result = await fetchMutation(
            api.users.associateUserToBootcamp,
            { userId, email: normalizedEmail, bootcampId },
            { token }
        );

        revalidatePath('/cms/usuarios');
        revalidatePath(`/cms/bootcamp/${result.bootcamp.id}/manage`);
        return { success: true, bootcamp: result.bootcamp };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'No se pudo asociar el usuario al bootcamp.' };
    }
}
