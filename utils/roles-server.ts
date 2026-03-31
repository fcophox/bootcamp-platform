import { createClient } from '@/utils/supabase/server';
import { Role } from './roles';

export async function getUserRoleFromDB(userId: string): Promise<Role> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return 'alumno'; // Default
    return data.role as Role;
}
