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

export async function getStudentById(studentId: number) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('BootcampStudent')
        .select('*')
        .eq('id', studentId)
        .single();

    if (error) {
        console.error('Error fetching student:', error);
        return null;
    }
    return data;
}

export async function getStudentCompletions(studentId: number) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('LessonCompletion')
        .select('lessonId, completedAt')
        .eq('studentId', studentId);

    if (error) {
        console.error('Error fetching completions:', error);
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
                    <h1 style="color: #6366f1; margin-bottom: 24px;">¡Hola! 👋</h1>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Se te ha invitado a participar en el bootcamp: <strong>${bootcampTitle}</strong>.
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Estamos muy emocionados de tenerte con nosotros. Haz clic en el botón de abajo para ir a la plataforma y comenzar tu aprendizaje.
                    </p>
                    <div style="text-align: center; margin-top: 32px; margin-bottom: 32px;">
                        <a href="${inviteUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">Ir a la plataforma</a>
                    </div>
                </div>
            `,
        });

        if (sendError) {
            console.warn('Student invited in DB but email failed:', sendError);
        }
    } catch (e) {
        console.error('Error in secondary invitation email logic:', e);
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

export async function updateStudentStatus(studentId: number, bootcampId: number, status: 'invited' | 'active' | 'completed') {
    const supabase = await createClient();
    const { error } = await supabase
        .from('BootcampStudent')
        .update({ status })
        .eq('id', studentId);

    if (error) throw error;
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function toggleLessonCompletion(bootcampId: number, lessonId: number) {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('No autenticado');

    // Find student record for this user and bootcamp
    const { data: student, error: studentError } = await supabase
        .from('BootcampStudent')
        .select('id')
        .ilike('email', user.email || '')
        .eq('bootcampId', bootcampId)
        .maybeSingle();

    if (studentError || !student) {
        console.error('SERVER ACTION ERROR: Student record not found for email:', user.email, 'and bootcampId:', bootcampId);
        throw new Error(`No estás registrado en este bootcamp con este correo (${user.email})`);
    }

    // Check if already completed
    const { data: existing } = await supabase
        .from('LessonCompletion')
        .select('id')
        .eq('studentId', student.id)
        .eq('lessonId', lessonId)
        .maybeSingle();

    if (existing) {
        // Remove completion
        await supabase
            .from('LessonCompletion')
            .delete()
            .eq('id', existing.id);
    } else {
        // Add completion
        await supabase
            .from('LessonCompletion')
            .insert({
                studentId: student.id,
                lessonId: lessonId,
                completedAt: new Date().toISOString()
            });
    }

    revalidatePath(`/dashboard/bootcamp/${bootcampId}`);
    revalidatePath(`/cms/bootcamp/${bootcampId}/student/${student.id}`);
}

export async function getMyCompletions(bootcampId: number) {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: student } = await supabase
        .from('BootcampStudent')
        .select('id')
        .ilike('email', user.email || '')
        .eq('bootcampId', bootcampId)
        .maybeSingle();

    if (!student) return [];

    const { data } = await supabase
        .from('LessonCompletion')
        .select('lessonId')
        .eq('studentId', student.id);

    return data?.map(c => c.lessonId) || [];
}

export async function getStudentExamAttempts(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('ExamAttempt')
        .select(`
            *,
            exam:Exam (
                title,
                timeLimitSeconds
            )
        `)
        .eq('userId', userId)
        .order('finishedAt', { ascending: false });

    if (error) {
        console.error('Error fetching student attempts:', error);
        return [];
    }
    return data;
}
