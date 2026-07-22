'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getRoleFromEmail } from '@/utils/roles';
import { hasBootcampStarted } from '@/utils/date';

export async function getStudents(bootcampId: number | string) {
    const supabase = await createClient();
    
    // Try to get students - bootcampId could be numeric (legacy) or Convex string ID
    const { data, error } = await supabase
        .from('BootcampStudent')
        .select('*')
        .eq('bootcampId', bootcampId)
        .order('invitedAt', { ascending: false });

    if (error) {
        console.error('Error fetching students:', error);
        return [];
    }

    if (data && (data as any[]).length > 0) {
        const emails = (data as any[]).map((s: any) => s.email);
        const { data: rolesData, error: rolesError } = await supabase
            .from('UserRole')
            .select('email, role')
            .in('email', emails);
        
        const roleMap = new Map<string, string>();
        if (!rolesError && rolesData) {
            (rolesData as any[]).forEach((r: any) => {
                roleMap.set(r.email.toLowerCase(), r.role);
            });
        }
        
        return (data as any[]).map((s: any) => {
            const dbRole = roleMap.get(s.email.toLowerCase());
            const finalRole = dbRole || getRoleFromEmail(s.email);
            return {
                ...s,
                role: finalRole
            };
        });
    }

    return [];
}

export async function getStudentById(studentId: number | string) {
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

export async function getStudentCompletions(studentId: number | string) {
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

export async function removeStudent(studentId: number | string, bootcampId: number | string) {
    const supabase = await createClient();
    
    // 1. Fetch student email and userId before deleting the record
    const { data: student } = await supabase
        .from('BootcampStudent')
        .select('email, userId')
        .eq('id', studentId)
        .maybeSingle();

    // 2. Delete the student enrollment
    const { error } = await supabase
        .from('BootcampStudent')
        .delete()
        .eq('id', studentId);

    if (error) {
        console.error('Error removing student:', error);
        throw new Error('Error al eliminar al estudiante.');
    }

    // 3. If the user is registered in Supabase Auth, check if they have other enrollments left
    if (student) {
        console.log(`Student deleted from bootcamp ${bootcampId}: ${student.email}`);
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function updateStudentStatus(studentId: number | string, bootcampId: number | string, status: 'invited' | 'active' | 'completed' | 'frozen') {
    const supabase = await createClient();
    const { error } = await supabase
        .from('BootcampStudent')
        .update({ status })
        .eq('id', studentId);

    if (error) throw error;
    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function toggleLessonCompletion(bootcampId: number | string, lessonId: number | string) {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('No autenticado');

    console.log('[toggleLessonCompletion] Starting:', { bootcampId, lessonId, userEmail: user.email });

    // Find student record for this user and bootcamp
    // Get full student data including legacyId
    let student: { id: number | string; legacyId?: number } | null = null;
    
    // Try numeric first
    const numericId = typeof bootcampId === 'string' ? parseInt(bootcampId, 10) : bootcampId;
    
    if (!isNaN(numericId)) {
        const { data: studentData, error: studentError } = await supabase
            .from('BootcampStudent')
            .select('id, legacyId')
            .ilike('email', user.email || '')
            .eq('bootcampId', numericId)
            .maybeSingle();
        
        console.log('[toggleLessonCompletion] Numeric bootcampId search:', { numericId, studentData, studentError });
        
        if (!studentError && studentData) {
            student = studentData;
        }
    }
    
    // If not found with numeric ID, try with string (Convex ID)
    if (!student && typeof bootcampId === 'string') {
        const { data: studentData, error: studentError } = await supabase
            .from('BootcampStudent')
            .select('id, legacyId')
            .ilike('email', user.email || '')
            .eq('bootcampId', bootcampId)
            .maybeSingle();
        
        console.log('[toggleLessonCompletion] String bootcampId search:', { bootcampId, studentData, studentError });
        
        if (!studentError && studentData) {
            student = studentData;
        }
    }

    if (!student) {
        console.error('[toggleLessonCompletion] Student record not found for email:', user.email, 'and bootcampId:', bootcampId);
        throw new Error(`No estás registrado en este bootcamp con este correo (${user.email})`);
    }

    console.log('[toggleLessonCompletion] Found student:', student);

    // Use legacyId for studentId if available (for compatibility with existing data)
    const studentIdForCompletion = student.legacyId || student.id;

    console.log('[toggleLessonCompletion] Looking for existing completion with:', { studentIdForCompletion, lessonId });

    // Check if already completed - search by legacyStudentId
    const { data: existing, error: existingError } = await supabase
        .from('LessonCompletion')
        .select('id')
        .eq('studentId', studentIdForCompletion)
        .eq('lessonId', lessonId)
        .maybeSingle();

    console.log('[toggleLessonCompletion] Existing completion:', { existing, existingError });

    if (existing) {
        // Remove completion
        const { error: deleteError } = await supabase
            .from('LessonCompletion')
            .delete()
            .eq('id', existing.id);
        
        console.log('[toggleLessonCompletion] Deleted completion:', { deleteError });
    } else {
        // Add completion with all necessary fields for Convex compatibility
        const insertData = {
            studentId: studentIdForCompletion,
            lessonId: lessonId,
            bootcampId: bootcampId,
            legacyStudentId: student.legacyId || null,
            legacyLessonId: lessonId,
            completedAt: Date.now() // Use timestamp number instead of ISO string
        };
        
        console.log('[toggleLessonCompletion] Inserting completion:', insertData);
        
        const { data: insertResult, error: insertError } = await supabase
            .from('LessonCompletion')
            .insert(insertData);
        
        console.log('[toggleLessonCompletion] Insert result:', { insertResult, insertError });
    }

    revalidatePath(`/dashboard/bootcamp/${bootcampId}`);
    revalidatePath(`/cms/bootcamp/${bootcampId}/student/${student.id}`);
}

export async function getMyCompletions(bootcampId: number | string) {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log('[getMyCompletions] No user found');
        return [];
    }

    console.log('[getMyCompletions] Starting:', { bootcampId, userEmail: user.email });

    // Try to find student with either numeric or string bootcampId
    // Include legacyId for completion lookup
    let student: { id: number | string; legacyId?: number } | null = null;
    
    const numericId = typeof bootcampId === 'string' ? parseInt(bootcampId, 10) : bootcampId;
    
    if (!isNaN(numericId)) {
        const { data: studentData, error } = await supabase
            .from('BootcampStudent')
            .select('id, legacyId')
            .ilike('email', user.email || '')
            .eq('bootcampId', numericId)
            .maybeSingle();
        
        console.log('[getMyCompletions] Numeric search result:', { numericId, studentData, error });
        
        if (studentData) {
            student = studentData;
        }
    }
    
    // If not found with numeric ID, try with string (Convex ID)
    if (!student && typeof bootcampId === 'string') {
        const { data: studentData, error } = await supabase
            .from('BootcampStudent')
            .select('id, legacyId')
            .ilike('email', user.email || '')
            .eq('bootcampId', bootcampId)
            .maybeSingle();
        
        console.log('[getMyCompletions] String search result:', { bootcampId, studentData, error });
        
        if (studentData) {
            student = studentData;
        }
    }

    if (!student) {
        console.log('[getMyCompletions] No student found');
        return [];
    }

    // Use legacyId for lookup if available (for compatibility with existing data)
    const studentIdForLookup = student.legacyId || student.id;
    
    console.log('[getMyCompletions] Looking up completions for studentId:', studentIdForLookup);

    const { data, error } = await supabase
        .from('LessonCompletion')
        .select('lessonId')
        .eq('studentId', studentIdForLookup);

    console.log('[getMyCompletions] Completions result:', { count: data?.length, data, error });

    return ((data as any[]) || []).map((c: any) => c.lessonId);
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

export async function autoActivateStudents(email: string) {
    if (!email) return;
    const supabase = await createClient();
    
    // Fetch all invited student records for this user
    const { data: enrollments, error } = await supabase
        .from('BootcampStudent')
        .select(`
            id,
            bootcampId,
            status,
            Bootcamp (
                startDate
            )
        `)
        .eq('email', email)
        .eq('status', 'invited');

    if (error || !enrollments || enrollments.length === 0) {
        return;
    }

    const idsToActivate: number[] = [];

    for (const enrollment of enrollments) {
        // cast because of Supabase joined relation types
        const bootcamp = enrollment.Bootcamp as any;
        if (bootcamp && bootcamp.startDate) {
            if (hasBootcampStarted(bootcamp.startDate)) {
                idsToActivate.push(enrollment.id);
            }
        }
    }

    if (idsToActivate.length > 0) {
        const { error: updateError } = await supabase
            .from('BootcampStudent')
            .update({ status: 'active', joinedAt: new Date().toISOString() })
            .in('id', idsToActivate);

        if (updateError) {
            console.error('Error auto-activating students:', updateError);
        } else {
            console.log(`Successfully auto-activated ${idsToActivate.length} student registrations for email ${email}`);
        }
    }
}
