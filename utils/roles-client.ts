import { createClient } from '@/utils/supabase/client';
import { Role } from './roles';

export async function getUserRoleFromDBClient(userId: string): Promise<Role> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return 'alumno'; // Default
    return data.role as Role;
}

export async function getAllUsersWithRoles(): Promise<any[]> {
    const supabase = createClient();
    
    // Fetch all users from UserRole
    const { data: users, error: userError } = await supabase
        .from('UserRole')
        .select('*')
        .order('created_at', { ascending: false });

    if (userError) return [];

    // Fetch all student registrations along with their bootcamp names
    const { data: enrollments, error: enrollError } = await supabase
        .from('BootcampStudent')
        .select(`
            email,
            status,
            bootcampId,
            Bootcamp (
                name
            )
        `);

    if (enrollError) {
        console.error('Error fetching enrollments:', enrollError);
        return users;
    }

    // Match users with their registrations
    return users.map(user => {
        const userEmailNormalized = user.email.trim().toLowerCase();
        
        const userRegistrations = enrollments.filter(reg => 
            reg.email.trim().toLowerCase() === userEmailNormalized
        );
        
        // Construct detailed bootcamp objects for the UI
        const userBootcamps = userRegistrations.map(reg => {
            const bootcampName = (reg.Bootcamp as any)?.name;
            return {
                id: reg.bootcampId,
                name: bootcampName || `ID: ${reg.bootcampId}`,
                status: reg.status,
                isPending: reg.status === 'invited'
            };
        });

        return {
            ...user,
            bootcamps: userBootcamps,
            hasEnrollments: userBootcamps.length > 0
        };
    });
}
