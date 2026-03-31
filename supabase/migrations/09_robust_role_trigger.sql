-- Update the trigger function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user_role() 
RETURNS TRIGGER AS $$
DECLARE
    role_val user_role_type;
BEGIN
    -- Determine role with safe casting
    BEGIN
        role_val := COALESCE((new.raw_user_meta_data->>'role')::user_role_type, 'alumno');
    EXCEPTION WHEN OTHERS THEN
        role_val := 'alumno';
    END;

    -- Robust Role Management: Detect and update existing roles by email to preserve privileges
    IF EXISTS (SELECT 1 FROM public."UserRole" WHERE email = new.email) THEN
        UPDATE public."UserRole" 
        SET id = new.id, updated_at = now() 
        WHERE email = new.email;
    ELSE
        INSERT INTO public."UserRole" (id, email, role)
        VALUES (new.id, new.email, role_val)
        ON CONFLICT (id) DO UPDATE SET 
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            updated_at = now();
    END IF;
        
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
