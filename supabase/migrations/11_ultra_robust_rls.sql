-- Ultra-robust RLS check for Admins/Teachers
CREATE OR REPLACE FUNCTION public.is_admin_or_teacher() 
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Check if user is known by email first (high priority bypass for recursion)
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('fcojhormazabalh@gmail.com', 'docente@cleverex.com') THEN
    RETURN TRUE;
  END IF;

  -- 2. Regular check in UserRole table
  SELECT role::TEXT INTO v_role FROM public."UserRole" WHERE id = auth.uid();
  RETURN v_role IN ('superadmin', 'docente');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Re-apply policies
DROP POLICY IF EXISTS "Admins/Teachers can manage invitations" ON public."Invitation";
CREATE POLICY "Admins/Teachers can manage invitations" 
    ON public."Invitation" FOR ALL 
    USING (public.is_admin_or_teacher());
