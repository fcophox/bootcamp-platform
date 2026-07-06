'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getRoleFromEmail } from '@/utils/roles';
import { hasBootcampStarted } from '@/utils/date';

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

    if (data && data.length > 0) {
        const emails = data.map(s => s.email);
        const { data: rolesData, error: rolesError } = await supabase
            .from('UserRole')
            .select('email, role')
            .in('email', emails);
        
        const roleMap = new Map<string, string>();
        if (!rolesError && rolesData) {
            rolesData.forEach(r => {
                roleMap.set(r.email.toLowerCase(), r.role);
            });
        }
        
        return data.map(s => {
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
        let targetUserId = student.userId;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // If targetUserId is missing but we have the service role key, resolve it
        if (!targetUserId && serviceRoleKey) {
            try {
                // A. Try UserRole table first
                const { data: roleRecord } = await supabase
                    .from('UserRole')
                    .select('id')
                    .eq('email', student.email)
                    .maybeSingle();

                if (roleRecord) {
                    targetUserId = roleRecord.id;
                } else {
                    // B. Fallback to listing auth users using adminClient
                    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
                    const adminClient = createAdminClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        serviceRoleKey,
                        { auth: { autoRefreshToken: false, persistSession: false } }
                    );
                    const { data: listData } = await adminClient.auth.admin.listUsers();
                    if (listData && listData.users) {
                        const matchedUser = listData.users.find(u => u.email?.toLowerCase() === student.email.toLowerCase());
                        if (matchedUser) {
                            targetUserId = matchedUser.id;
                        }
                    }
                }
            } catch (err) {
                console.error('Error resolving userId for email:', student.email, err);
            }
        }

        if (targetUserId) {
            const { data: otherEnrollments } = await supabase
                .from('BootcampStudent')
                .select('id')
                .eq('email', student.email);

            // If they have no other bootcamps, and we have the service role key, delete them from auth.users and UserRole
            if (serviceRoleKey && (!otherEnrollments || otherEnrollments.length === 0)) {
                try {
                    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
                    const adminClient = createAdminClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        serviceRoleKey,
                        { auth: { autoRefreshToken: false, persistSession: false } }
                    );

                    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
                    if (deleteError) {
                        console.error(`Error deleting auth user ${targetUserId} from Supabase Auth:`, deleteError);
                    } else {
                        console.log(`Successfully deleted auth user ${targetUserId} (${student.email}) from Supabase Auth.`);
                        
                        // Clean up UserRole table as well
                        await adminClient
                            .from('UserRole')
                            .delete()
                            .eq('id', targetUserId);
                    }
                } catch (e) {
                    console.error(`Exception while deleting auth user ${targetUserId} from Supabase Auth:`, e);
                }
            } else if (!serviceRoleKey) {
                console.log(`Student deleted from bootcamp, but Auth deletion skipped: SUPABASE_SERVICE_ROLE_KEY is not configured.`);
            } else {
                console.log(`Student deleted from bootcamp, but Auth deletion skipped: they are enrolled in other bootcamps.`);
            }
        }
    }

    revalidatePath(`/cms/bootcamp/${bootcampId}/manage`);
}

export async function updateStudentStatus(studentId: number, bootcampId: number, status: 'invited' | 'active' | 'completed' | 'frozen') {
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
