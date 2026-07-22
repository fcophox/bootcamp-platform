'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';

function generateRandomToken(length: number = 24): string {
    return randomBytes(length).toString('hex').slice(0, length);
}

export async function createInvitation(bootcampId: number | string): Promise<{ token: string } | { error: string }> {
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
    
    // Set expiration to 7 days from now
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    
    // Determine if bootcampId is numeric (legacy) or string (Convex ID)
    const numericId = typeof bootcampId === 'number' 
        ? bootcampId 
        : parseInt(String(bootcampId), 10);
    
    const isLegacyId = !isNaN(numericId) && String(numericId) === String(bootcampId);

    // 4. Perform insert with all required fields for Convex
    const { error } = await supabase
        .from('Invitation')
        .insert({ 
            // Store the original bootcampId (could be Convex ID string or legacy numeric)
            bootcampId: bootcampId,
            // Only set legacyBootcampId if it's actually a numeric ID
            legacyBootcampId: isLegacyId ? numericId : null,
            token,
            isUsed: false,
            status: 'pending',
            expiresAt,
            createdAt: Date.now(),
        });

    if (error) {
        console.error('[INVITE ERROR]', error);
        return { error: 'No se pudo crear el enlace. Verifica los permisos de invitación.' };
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
    
    // Return the token we generated (not from DB response)
    return { token };
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
