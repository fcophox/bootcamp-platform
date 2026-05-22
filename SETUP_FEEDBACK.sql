-- Crea la tabla para almacenar el Feedback de las lecciones
CREATE TABLE IF NOT EXISTS public."LessonFeedback" (
    id SERIAL PRIMARY KEY,
    "lessonId" INTEGER NOT NULL REFERENCES public."Lesson"(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "isLiked" BOOLEAN,
    "comment" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE("lessonId", "userId")
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public."LessonFeedback" ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
-- 1. Los usuarios pueden ver su propio feedback
CREATE POLICY "Users can view their own feedback" 
ON public."LessonFeedback" FOR SELECT 
TO authenticated 
USING (auth.uid() = "userId");

-- 2. Los superadmins o docentes pueden ver todo el feedback
-- Asumiendo que existe una tabla UserRole o similar para determinar permisos
CREATE POLICY "Admins can view all feedback" 
ON public."LessonFeedback" FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public."UserRole" 
        WHERE id = auth.uid() AND role IN ('superadmin', 'docente')
    )
);

-- 3. Los usuarios pueden insertar y actualizar su propio feedback
CREATE POLICY "Users can insert their own feedback" 
ON public."LessonFeedback" FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update their own feedback" 
ON public."LessonFeedback" FOR UPDATE 
TO authenticated 
USING (auth.uid() = "userId");

-- Si tienes problemas al hacer JOIN con 'User:userId(email, id)' en Supabase
-- necesitas asegurarte de tener una tabla pública User, o una vista, que refleje auth.users.
-- Si aún no existe, aquí te dejo un ejemplo de cómo crear una tabla 'User' en public 
-- que se sincronice con auth.users:

/*
CREATE TABLE IF NOT EXISTS public."User" (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT
);

-- Función para insertar automáticamente en public."User" cuando alguien se registra
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public."User" (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la función
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
*/
