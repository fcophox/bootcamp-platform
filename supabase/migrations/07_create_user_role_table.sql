-- Create an enum for roles
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('superadmin', 'docente', 'alumno');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Profile/UserRole table
CREATE TABLE IF NOT EXISTS public."UserRole" (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role_type NOT NULL DEFAULT 'alumno',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public."UserRole" ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY "Users can view their own role" 
    ON public."UserRole" FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Admins and teachers can view all roles" 
    ON public."UserRole" FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public."UserRole" 
            WHERE id = auth.uid() AND role IN ('superadmin', 'docente')
        )
    );

-- Trigger to create a role record when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_role() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public."UserRole" (id, email, role)
    VALUES (
        new.id, 
        new.email, 
        COALESCE((new.raw_user_meta_data->>'role')::user_role_type, 'alumno')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_role();
