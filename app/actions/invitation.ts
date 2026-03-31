'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';

function generateRandomToken(length: number = 24): string {
    return randomBytes(length).toString('hex').slice(0, length);
}

export async function createInvitation(bootcampId: number): Promise<{ token: string } | { error: string }> {
    const supabase = await createClient();
    
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    // 2. Log attempt for debugging if needed
    console.log(`[INVITE] Creating token for bootcamp ${bootcampId} by ${user.email}`);

    // 3. Ensure UserRole exists (self-healing)
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (!roleData) {
        const fallbackRole = (user.email === 'fcojhormazabalh@gmail.com' || user.email === 'docente@cleverex.com') 
            ? (user.email === 'fcojhormazabalh@gmail.com' ? 'superadmin' : 'docente') 
            : 'alumno';
        
        if (fallbackRole !== 'alumno') {
            await supabase.from('UserRole').upsert({ id: user.id, email: user.email, role: fallbackRole });
        }
    }

    const token = generateRandomToken(30);

    // 4. Perform insert. 
    const { data: invitation, error } = await supabase
        .from('Invitation')
        .insert({ bootcampId, token })
        .select('token')
        .single();

    if (error) {
        console.error('[INVITE ERROR] Code:', error.code, 'Msg:', error.message);
        if (error.code === '42501') {
            return { error: 'Error de permisos de base de datos (RS). Por favor, ejecuta la migración 11 en Supabase.' };
        }
        return { error: 'No se pudo crear el enlace. Verifica los permisos de invitación.' };
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    return { token: invitation.token };
}

export async function validateInvitation(token: string): Promise<{ bootcampId: number } | { error: string }> {
    const supabase = await createClient();
    
    const { data: invitation, error } = await supabase
        .from('Invitation')
        .select('bootcampId, isUsed, expiresAt')
        .eq('token', token)
        .maybeSingle();

    if (error || !invitation) return { error: 'Enlace inválido o expirado' };
    if (invitation.isUsed) return { error: 'Este enlace ya fue utilizado' };
    if (new Date(invitation.expiresAt) < new Date()) return { error: 'Este enlace ha caducado' };

    return { bootcampId: invitation.bootcampId };
}
