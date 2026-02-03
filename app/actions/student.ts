'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getStudents(bootcampId: number) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('BootcampStudent')
        .select('*')
        .eq('bootcampId', bootcampId)
        .order('invitedAt', { ascending: false });

    if (error) {
        console.error('Error fetching students:', error);
        return [];
    }
    return data;
}

export async function inviteStudent(bootcampId: number, email: string) {
    const supabase = await createClient();

    // Check if already exists
    const { data: existing } = await supabase
        .from('BootcampStudent')
        .select('id')
        .eq('bootcampId', bootcampId)
        .eq('email', email)
        .single();

    if (existing) {
        throw new Error('El estudiante ya ha sido invitado a este bootcamp.');
    }

    const { error } = await supabase
        .from('BootcampStudent')
        .insert({
            bootcampId,
            email,
            status: 'invited',
        });

    if (error) {
        console.error('Error inviting student:', error);
        throw new Error('Error al invitar al estudiante.');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function removeStudent(studentId: number, bootcampId: number) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('BootcampStudent')
        .delete()
        .eq('id', studentId);

    if (error) {
        console.error('Error removing student:', error);
        throw new Error('Error al eliminar al estudiante.');
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}
