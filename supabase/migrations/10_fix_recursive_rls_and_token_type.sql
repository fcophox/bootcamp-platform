-- Final fix for RLS recursion across all tables
DROP POLICY IF EXISTS "Admins and teachers can view all roles" ON public."UserRole";
DROP POLICY IF EXISTS "Admins/Teachers can manage invitations" ON public."Invitation";

-- Create a robust non-recursive helper function (Security Definer)
CREATE OR REPLACE FUNCTION public.is_admin_or_teacher() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public."UserRole" 
    WHERE id = auth.uid() AND role IN ('superadmin', 'docente')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-apply policies using the safe function
CREATE POLICY "Admins and teachers can view all roles" 
    ON public."UserRole" FOR SELECT 
    USING (public.is_admin_or_teacher() OR id = auth.uid());

CREATE POLICY "Admins/Teachers can manage invitations" 
    ON public."Invitation" FOR ALL 
    USING (public.is_admin_or_teacher());

-- Ensure Invitation table supports strings
DO $$ 
BEGIN
    ALTER TABLE public."Invitation" ALTER COLUMN token TYPE TEXT;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
