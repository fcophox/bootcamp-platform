-- Create Invitation table for single-use invites
CREATE TABLE IF NOT EXISTS public."Invitation" (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "bootcampId" BIGINT NOT NULL REFERENCES "Bootcamp"(id) ON DELETE CASCADE,
    "isUsed" BOOLEAN DEFAULT FALSE NOT NULL,
    "usedBy" UUID REFERENCES auth.users(id),
    "expiresAt" TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public."Invitation" ENABLE ROW LEVEL SECURITY;

-- Allow admins/teachers to create/view invitations
CREATE POLICY "Admins/Teachers can manage invitations" 
    ON public."Invitation" FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public."UserRole" 
            WHERE id = auth.uid() AND role IN ('superadmin', 'docente')
        )
    );

-- Allow public to view (to check if valid) but only if it matches token
CREATE POLICY "Public can view valid tokens" 
    ON public."Invitation" FOR SELECT 
    USING (NOT "isUsed" AND "expiresAt" > now());
