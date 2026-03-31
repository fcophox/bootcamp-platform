-- Ultra-Robust User Creation Trigger (Roles + Enrollment)
CREATE OR REPLACE FUNCTION public.handle_new_user_role() 
RETURNS TRIGGER AS $$
DECLARE
    v_role user_role_type;
    v_token TEXT;
    v_bootcamp_id INT;
BEGIN
    -- 1. PROFILE / ROLE CREATION
    BEGIN
        v_role := COALESCE((new.raw_user_meta_data->>'role')::user_role_type, 'alumno');
    EXCEPTION WHEN OTHERS THEN
        v_role := 'alumno';
    END;

    INSERT INTO public."UserRole" (id, email, role)
    VALUES (new.id, new.email, v_role)
    ON CONFLICT (email) DO UPDATE SET 
        id = EXCLUDED.id,
        role = EXCLUDED.role,
        updated_at = now();

    -- 2. AUTOMATIC ENROLLMENT (Via Metadata)
    v_token := new.raw_user_meta_data->>'invitation_token';
    v_bootcamp_id := (new.raw_user_meta_data->>'enroll_invite_id')::INT;

    -- Case A: Invitation Token (Check if valid and not used)
    IF v_token IS NOT NULL THEN
        -- Find bootcamp for this token
        SELECT "bootcampId" INTO v_bootcamp_id FROM public."Invitation" 
        WHERE token = v_token AND "isUsed" = false AND "expiresAt" > now()
        LIMIT 1;

        IF v_bootcamp_id IS NOT NULL THEN
            -- Enroll student
            INSERT INTO public."BootcampStudent" ("bootcampId", "userId", "email", "status")
            VALUES (v_bootcamp_id, new.id, new.email, 'invited')
            ON CONFLICT ("bootcampId", "email") DO UPDATE SET "userId" = new.id;

            -- Mark token as used
            UPDATE public."Invitation" SET "isUsed" = true, "usedBy" = new.id WHERE token = v_token;
        END IF;
    
    -- Case B: Direct Invite ID (Fallback from legacy or explicit metadata)
    ELSIF v_bootcamp_id IS NOT NULL THEN
        INSERT INTO public."BootcampStudent" ("bootcampId", "userId", "email", "status")
        VALUES (v_bootcamp_id, new.id, new.email, 'invited')
        ON CONFLICT ("bootcampId", "email") DO UPDATE SET "userId" = new.id;
    END IF;

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    -- Safety: Never block user signup
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_role();
