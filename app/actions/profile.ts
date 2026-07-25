'use server'

import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { fetchMutation, fetchAction } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { revalidatePath } from 'next/cache'

export async function updateProfile(data: {
    name?: string;
    bio?: string;
    location?: string;
    skills?: string;
    avatar?: string;
    jobTitle?: string;
}) {
    const token = await convexAuthNextjsToken()
    if (!token) {
        return { error: 'No autorizado' }
    }

    try {
        await fetchMutation(api.users.updateProfile, data, { token })
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error al actualizar el perfil' }
    }

    revalidatePath('/dashboard/perfil')
    return { success: true }
}

export async function changePassword(data: {
    currentPassword: string;
    newPassword: string;
}) {
    const token = await convexAuthNextjsToken()
    if (!token) {
        return { error: 'No autorizado' }
    }

    try {
        const result = await fetchAction(api.passwordReset.changePassword, data, { token })
        return { success: result.success, message: result.message }
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error al cambiar la contraseña.' }
    }
}
