'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CertificateData {
    bootcampId: number;
    title: string;
    backgroundImageUrl?: string;
    textColor?: string;
    titleFontSize?: number;
    nameFontSize?: number;
    programFontSize?: number;
    dateFontSize?: number;
    namePositionY?: number;
    programPositionY?: number;
    datePositionY?: number;
    showInstructorSignature?: boolean;
    showDirectorSignature?: boolean;
    instructorName?: string;
    directorName?: string;
    instructorSignatureUrl?: string;
    directorSignatureUrl?: string;
    isActive?: boolean;
}

export async function createCertificate(data: CertificateData) {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { error: 'No autorizado' }
    }

    // Check user role
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!roleData || roleData.role !== 'superadmin') {
        return { error: 'No tienes permisos para crear certificados' }
    }

    const { data: certificate, error } = await supabase
        .from('Certificate')
        .insert({
            bootcampId: data.bootcampId,
            title: data.title,
            backgroundImageUrl: data.backgroundImageUrl || null,
            textColor: data.textColor || '#000000',
            titleFontSize: data.titleFontSize || 24,
            nameFontSize: data.nameFontSize || 32,
            programFontSize: data.programFontSize || 20,
            dateFontSize: data.dateFontSize || 14,
            namePositionY: data.namePositionY || 50,
            programPositionY: data.programPositionY || 60,
            datePositionY: data.datePositionY || 75,
            showInstructorSignature: data.showInstructorSignature ?? true,
            showDirectorSignature: data.showDirectorSignature ?? true,
            instructorName: data.instructorName || null,
            directorName: data.directorName || null,
            instructorSignatureUrl: data.instructorSignatureUrl || null,
            directorSignatureUrl: data.directorSignatureUrl || null,
            isActive: data.isActive || false,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating certificate:', error)
        return { error: error.message }
    }

    revalidatePath('/cms/certificados')
    return { success: true, certificate }
}

export async function updateCertificate(id: number, data: Partial<CertificateData>) {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { error: 'No autorizado' }
    }

    // Check user role
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!roleData || roleData.role !== 'superadmin') {
        return { error: 'No tienes permisos para editar certificados' }
    }

    // If activating this certificate, deactivate others for the same bootcamp
    if (data.isActive) {
        const { data: existingCert } = await supabase
            .from('Certificate')
            .select('bootcampId')
            .eq('id', id)
            .single()

        if (existingCert) {
            await supabase
                .from('Certificate')
                .update({ isActive: false })
                .eq('bootcampId', existingCert.bootcampId)
                .neq('id', id)
        }
    }

    const { error } = await supabase
        .from('Certificate')
        .update(data)
        .eq('id', id)

    if (error) {
        console.error('Error updating certificate:', error)
        return { error: error.message }
    }

    revalidatePath('/cms/certificados')
    return { success: true }
}

export async function deleteCertificate(id: number) {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { error: 'No autorizado' }
    }

    // Check user role
    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!roleData || roleData.role !== 'superadmin') {
        return { error: 'No tienes permisos para eliminar certificados' }
    }

    const { error } = await supabase
        .from('Certificate')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting certificate:', error)
        return { error: error.message }
    }

    revalidatePath('/cms/certificados')
    return { success: true }
}

export async function getAllCertificates() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('Certificate')
        .select(`
            *,
            Bootcamp:bootcampId (
                id,
                title,
                icon,
                color
            )
        `)
        .order('createdAt', { ascending: false })

    if (error) {
        console.error('Error fetching certificates:', error)
        return []
    }

    return data
}

export async function getCertificateById(id: number) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('Certificate')
        .select(`
            *,
            Bootcamp:bootcampId (
                id,
                title,
                icon,
                color
            )
        `)
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching certificate:', error)
        return null
    }

    return data
}

export async function getCertificateByBootcamp(bootcampId: number) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('Certificate')
        .select('*')
        .eq('bootcampId', bootcampId)
        .eq('isActive', true)
        .single()

    if (error) {
        // No active certificate found is not an error
        if (error.code === 'PGRST116') {
            return null
        }
        console.error('Error fetching certificate:', error)
        return null
    }

    return data
}

export async function activateCertificate(id: number) {
    return updateCertificate(id, { isActive: true })
}

export async function deactivateCertificate(id: number) {
    return updateCertificate(id, { isActive: false })
}
