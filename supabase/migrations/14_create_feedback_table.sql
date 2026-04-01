-- Create LessonFeedback table
CREATE TABLE IF NOT EXISTS public."LessonFeedback" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "lessonId" BIGINT NOT NULL REFERENCES public."Lesson"(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "isLiked" BOOLEAN, -- TRUE: Like, FALSE: Dislike, NULL: None
  "comment" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE ("lessonId", "userId")
);

-- Enable RLS
ALTER TABLE public."LessonFeedback" ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can manage their own feedback
CREATE POLICY "Users can manage their own feedback" 
    ON public."LessonFeedback" FOR ALL 
    USING (auth.uid() = "userId")
    WITH CHECK (auth.uid() = "userId");

-- 2. Superadmins and Docentes can see all feedback
CREATE POLICY "Superadmins and Docentes can see all feedback" 
    ON public."LessonFeedback" FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public."UserRole" 
            WHERE id = auth.uid() AND role IN ('superadmin', 'docente')
        )
    );

-- 3. Update existing references for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS "idx_lesson_feedback_lesson_id" ON public."LessonFeedback"("lessonId");
CREATE INDEX IF NOT EXISTS "idx_lesson_feedback_user_id" ON public."LessonFeedback"("userId");
