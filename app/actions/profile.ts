'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(data: {
    full_name?: string;
    bio?: string;
    location?: string;
    skills?: string;
}) {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { error: 'No autorizado' }
    }

    const { error } = await supabase.auth.updateUser({
        data: {
            full_name: data.full_name,
            bio: data.bio,
            location: data.location,
            skills: data.skills,
        }
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/dashboard/perfil')
    return { success: true }
}
