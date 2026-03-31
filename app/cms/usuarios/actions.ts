'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function deleteUser(userId: string) {
    const supabase = await createClient();
    
    // First, delete from UserRole
    const { error: roleError } = await supabase
        .from('UserRole')
        .delete()
        .eq('id', userId);

    if (roleError) {
        return { error: roleError.message };
    }

    // Also delete from BootcampStudent registrations
    await supabase
        .from('BootcampStudent')
        .delete()
        .eq('userId', userId);

    revalidatePath('/cms/usuarios');
    return { success: true };
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
