'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

async function getCurrentUser() {
    const token = await convexAuthNextjsToken();
    if (!token) return null;
    
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );
    
    return currentUser;
}

export interface CertificateData {
    bootcampId: number | string;
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
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return { error: 'No autorizado' }
    }

    if (currentUser.role !== 'superadmin') {
        return { error: 'No tienes permisos para crear certificados' }
    }

    const supabase = await createClient()

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

export async function updateCertificate(id: number | string, data: Partial<CertificateData>) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return { error: 'No autorizado' }
    }

    if (currentUser.role !== 'superadmin') {
        return { error: 'No tienes permisos para editar certificados' }
    }

    const supabase = await createClient()

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

export async function deleteCertificate(id: number | string) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return { error: 'No autorizado' }
    }

    if (currentUser.role !== 'superadmin') {
        return { error: 'No tienes permisos para eliminar certificados' }
    }

    const supabase = await createClient()

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

    // Get all certificates
    const { data: certificates, error } = await supabase
        .from('Certificate')
        .select('*')
        .order('createdAt', { ascending: false })

    if (error) {
        console.error('Error fetching certificates:', error)
        return []
    }

    if (!certificates || certificates.length === 0) return []

    // Get unique bootcamp IDs
    const bootcampIds = [...new Set((certificates as any[]).map(c => c.bootcampId))]
    
    // Get bootcamps separately
    const { data: bootcamps } = await supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .in('id', bootcampIds)

    // Create bootcamp map
    const bootcampMap: Record<string, any> = {}
    for (const bc of (bootcamps || []) as any[]) {
        bootcampMap[bc.id] = bc
    }

    // Add Bootcamp info to each certificate
    return (certificates as any[]).map(cert => ({
        ...cert,
        Bootcamp: bootcampMap[cert.bootcampId] || null
    }))
}

export async function getCertificateById(id: number | string) {
    const supabase = await createClient()

    const { data: certificate, error } = await supabase
        .from('Certificate')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching certificate:', error)
        return null
    }

    if (!certificate) return null

    // Get bootcamp separately
    const { data: bootcamp } = await supabase
        .from('Bootcamp')
        .select('id, title, icon, color')
        .eq('id', (certificate as any).bootcampId)
        .single()

    return {
        ...certificate,
        Bootcamp: bootcamp || null
    }
}

export async function getCertificateByBootcamp(bootcampId: number | string) {
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

export async function activateCertificate(id: number | string) {
    return updateCertificate(id, { isActive: true })
}

export async function deactivateCertificate(id: number | string) {
    return updateCertificate(id, { isActive: false })
}
