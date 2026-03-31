import { createClient } from '@/utils/supabase/client';
import { Role } from './roles';

export interface UserWithRole {
    id: string;
    email: string;
    role: Role;
    created_at: string;
    updated_at: string;
    bootcamps?: Array<{
        id: number;
        name: string;
        status: string;
        isPending: boolean;
    }>;
    hasEnrollments?: boolean;
}

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

export async function getAllUsersWithRoles(): Promise<UserWithRole[]> {
    const supabase = createClient();
    
    // Fetch all users from UserRole
    const { data: users, error: userError } = await supabase
        .from('UserRole')
        .select('*')
        .order('created_at', { ascending: false });

    if (userError || !users) return [];

    // Fetch all student registrations along with their bootcamp names
    const { data: enrollments, error: enrollError } = await supabase
        .from('BootcampStudent')
        .select(`
            email,
            status,
            bootcampId,
            Bootcamp:Bootcamp (
                name
            )
        `);

    // Use unknown then cast to avoid overlap error with Supabase's automatic complex types
    const typedEnrollments = (enrollments as unknown) as Array<{
        email: string;
        status: string;
        bootcampId: number;
        Bootcamp: { name: string } | null;
    }>;

    if (enrollError) {
        console.error('Error fetching enrollments:', enrollError);
        return users as UserWithRole[];
    }

    // Match users with their registrations
    return users.map(user => {
        const userEmailNormalized = user.email.trim().toLowerCase();
        
        const userRegistrations = (typedEnrollments || []).filter(reg => 
            reg.email?.trim().toLowerCase() === userEmailNormalized
        );
        
        // Construct detailed bootcamp objects for the UI
        const userBootcamps = userRegistrations.map(reg => {
            const bootcampName = reg.Bootcamp?.name;
            return {
                id: reg.bootcampId,
                name: bootcampName || `ID: ${reg.bootcampId}`,
                status: reg.status,
                isPending: reg.status === 'invited'
            };
        });

        return {
            ...user,
            role: user.role as Role,
            bootcamps: userBootcamps,
            hasEnrollments: userBootcamps.length > 0
        };
    }) as UserWithRole[];
}
