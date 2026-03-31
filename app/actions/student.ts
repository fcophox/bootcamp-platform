'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

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
        .maybeSingle();

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
        throw new Error(`Error al invitar: ${error.message || error.details || 'Error desconocido'}`);
    }

    // -- EMAIL SENDING LOGIC (Flexible: Resend or SMTP) --
    try {
        // Fetch bootcamp title for the email
        const { data: bootcamp } = await supabase
            .from('Bootcamp')
            .select('title')
            .eq('id', bootcampId)
            .single();

        const bootcampTitle = bootcamp?.title || 'nuestro bootcamp';

        const headersList = await headers();
        const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const inviteUrl = `${origin}/login`;

        // Send Email using our new utility
        const { sendEmail } = await import('@/lib/email');
        const { error: sendError } = await sendEmail({
            to: email,
            subject: `Te han invitado al curso: ${bootcampTitle}`,
            html: `
                <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 20px;">
                    <h2 style="color: #333;">¡Hola!</h2>
                    <p>Has sido invitado a unirte y cursar el bootcamp: <strong>${bootcampTitle}</strong>.</p>
                    <p>Para aceptar la invitación y comenzar a aprender, por favor haz clic en el botón a continuación para registrarte (o iniciar sesión si ya tienes cuenta) usando este mismo correo (<strong>${email}</strong>):</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${inviteUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acceder a la plataforma</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">Si el botón no funciona, copia y pega este enlace en tu navegador: <br>${inviteUrl}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">Este es un correo automático, por favor no lo respondas.</p>
                </div>
            `
        });

        if (sendError) {
            console.error('Email sending failed:', sendError);
            // We throw here if we want the UI to know the email failed
            throw new Error(`El alumno fue registrado pero no se pudo enviar el correo: ${sendError.message || 'Error de configuración de correo'}`);
        }

        console.log(`Invitation email successfully sent to ${email}`);

    } catch (emailError: any) {
        console.error('Email action error:', emailError);
        throw emailError; // Re-throw to show in UI
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function updateStudentStatus(studentId: number, bootcampId: number, status: 'invited' | 'active' | 'completed') {
    const supabase = await createClient();
    const { error } = await supabase
        .from('BootcampStudent')
        .update({ status })
        .eq('id', studentId);

    if (error) {
        console.error('Error updating status:', error);
        throw new Error('Error al actualizar el estado del alumno.');
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
