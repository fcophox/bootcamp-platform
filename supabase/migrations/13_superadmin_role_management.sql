-- Grant superadmins total control over roles and students
-- This allows the management interface to perform UPDATE and DELETE operations in production

-- 1. Policies for UserRole table
DROP POLICY IF EXISTS "Superadmin can manage all roles" ON public."UserRole";
CREATE POLICY "Superadmin can manage all roles" 
    ON public."UserRole" FOR ALL 
    USING (public.is_admin_or_teacher());

-- 2. Policies for BootcampStudent table (to allow deleting students)
DROP POLICY IF EXISTS "Superadmin can manage all students" ON public."BootcampStudent";
CREATE POLICY "Superadmin can manage all students" 
    ON public."BootcampStudent" FOR ALL 
    USING (public.is_admin_or_teacher());

-- Ensure the is_admin_or_teacher function is accessible
GRANT EXECUTE ON FUNCTION public.is_admin_or_teacher() TO authenticated, anon, service_role;
