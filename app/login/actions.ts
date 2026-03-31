'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getRoleFromEmail } from '@/utils/roles'
import { getUserRoleFromDB } from '@/utils/roles-server'
import { validateInvitation } from '@/app/actions/invitation'

export async function login(formData: FormData, inviteId?: string | null, token?: string | null) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    console.log('Login attempt for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        console.error('Login error:', error.message);
        return { error: error.message }
    }

    console.log('Login successful for:', email, 'User ID:', data.user.id);

    // Join bootcamp if inviteId or token is present
    if (token && data.user) {
        console.log('Processing token for login:', token);
        const validation = await validateInvitation(token);
        if ('bootcampId' in validation) {
            await joinBootcamp(data.user.id, email, validation.bootcampId, token);
        }
    } else if (inviteId && data.user) {
        console.log('Processing inviteId for login:', inviteId);
        await joinBootcamp(data.user.id, email, parseInt(inviteId))
    }

    revalidatePath('/', 'layout')
    
    const dbUser = data.user;
    const dbRole = dbUser ? await getUserRoleFromDB(dbUser.id) : null;
    const fallbackRole = getRoleFromEmail(email, dbUser?.user_metadata);
    
    const userRole = (dbRole && dbRole !== 'alumno') ? dbRole : fallbackRole;
    console.log('Derived userRole for login:', userRole, '(DB:', dbRole, 'Fallback:', fallbackRole, ')');

    // Auto-fix if DB says alumno but hardcoded says superadmin (Self-healing role)
    if (userRole === 'superadmin' && dbRole === 'alumno' && dbUser) {
        console.log('Auto-upgrading DB role for Superadmin account...');
        await supabase.from('UserRole').update({ role: 'superadmin' }).eq('id', dbUser.id);
    }

    if (userRole === 'superadmin' || userRole === 'docente') {
        console.log('Redirecting to /cms');
        redirect('/cms')
    } else {
        console.log('Redirecting to /dashboard');
        redirect('/dashboard')
    }
}

export async function signup(formData: FormData, inviteId?: string | null, token?: string | null) {
    const supabase = await createClient()

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                role: 'alumno',
                invitation_token: token || null,
                enroll_invite_id: inviteId ? parseInt(inviteId) : null
            }
        }
    })

    if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
            return { error: 'Este correo ya tiene una cuenta activa. Por favor, inicia sesión con tu contraseña anterior en la pestaña de "Ingresar" para continuar.' }
        }
        return { error: error.message }
    }

    if (data.user && !data.session) {
        // Enrollment is now handled atomically by the DB trigger via metadata
        return { success: '¡Registro exitoso! Por favor revisa tu correo para confirmar tu cuenta antes de iniciar sesión.' }
    }
    
    if (token && data.user) {
        // Only if session is active (already confirmed)
        const validation = await validateInvitation(token);
        if ('bootcampId' in validation) {
            await joinBootcamp(data.user.id, email, validation.bootcampId, token);
        }
    } else if (inviteId && data.user) {
        await joinBootcamp(data.user.id, email, parseInt(inviteId))
    }

    revalidatePath('/', 'layout')
    
    const dbUser = data.user;
    const dbRole = dbUser ? await getUserRoleFromDB(dbUser.id) : null;
    const fallbackRole = getRoleFromEmail(email, (dbUser as any)?.user_metadata);
    const userRole = (dbRole && dbRole !== 'alumno') ? dbRole : fallbackRole;

    if (userRole === 'superadmin' || userRole === 'docente') {
        redirect('/cms')
    } else {
        redirect('/dashboard')
    }
}

async function joinBootcamp(userId: string, email: string, bootcampId: number, token?: string | null) {
    const supabase = await createClient()
    
    // Check if already in
    const { data: existing } = await supabase
        .from('BootcampStudent')
        .select('id')
        .eq('bootcampId', bootcampId)
        .eq('email', email)
        .maybeSingle()

    if (existing) {
        // Update user ID if it was missing (e.g. they were invited by email before)
        await supabase
            .from('BootcampStudent')
            .update({ userId, status: 'active' })
            .eq('id', existing.id)
    } else {
        // Create new active registration
        await supabase
            .from('BootcampStudent')
            .insert({
                bootcampId,
                email,
                userId,
                status: 'invited', // Starts as pending approval
            })
    }

    // Mark token as used if present
    if (token) {
        await supabase
            .from('Invitation')
            .update({ isUsed: true, usedBy: userId })
            .eq('token', token);
    }
}
