-- ================================================
-- Tabla: MedicionPregunta
-- Preguntas de medición creadas por docentes/admins
-- para un bootcamp específico.
-- ================================================
CREATE TABLE IF NOT EXISTS public."MedicionPregunta" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "bootcampId" BIGINT NOT NULL REFERENCES public."Bootcamp"(id) ON DELETE CASCADE,
  "createdBy" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "texto" TEXT NOT NULL,
  "tipo" TEXT NOT NULL CHECK (
    "tipo" IN (
      'likert_5',       -- Escala Likert 1–5
      'caras',          -- Carita contenta / seria / confundida
      'nps',            -- Net Promoter Score 0–10
      'like_dislike',   -- Like o Dislike
      'escala_7',       -- Escala 1–7
      'escala_3',       -- Escala 1–3
      'comentario',     -- Texto libre (textarea)
      'alternativas'    -- Opciones de selección única
    )
  ),
  "opciones" JSONB,                          -- Para tipo 'alternativas': array de strings
  "orden" INTEGER NOT NULL DEFAULT 0,
  "enviada" BOOLEAN NOT NULL DEFAULT FALSE,
  "pausada" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ================================================
-- Tabla: MedicionRespuesta
-- Respuestas de alumnos a las preguntas de medición
-- ================================================
CREATE TABLE IF NOT EXISTS public."MedicionRespuesta" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "preguntaId" UUID NOT NULL REFERENCES public."MedicionPregunta"(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "valor" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE ("preguntaId", "userId")
);

-- ================================================
-- RLS
-- ================================================
ALTER TABLE public."MedicionPregunta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MedicionRespuesta" ENABLE ROW LEVEL SECURITY;

-- MedicionPregunta: admins/docentes pueden leer y escribir
CREATE POLICY "Admins y docentes gestionan preguntas"
  ON public."MedicionPregunta" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."UserRole"
      WHERE id = auth.uid() AND role IN ('superadmin', 'docente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."UserRole"
      WHERE id = auth.uid() AND role IN ('superadmin', 'docente')
    )
  );

-- MedicionPregunta: alumnos solo leen preguntas enviadas de sus bootcamps
CREATE POLICY "Alumnos ven preguntas enviadas de sus bootcamps"
  ON public."MedicionPregunta" FOR SELECT
  USING (
    "enviada" = TRUE AND EXISTS (
      SELECT 1 FROM public."BootcampStudent"
      WHERE "bootcampId" = "MedicionPregunta"."bootcampId"
        AND "userId" = auth.uid()
    )
  );

-- MedicionRespuesta: alumnos gestionan sus propias respuestas
CREATE POLICY "Alumnos gestionan sus respuestas"
  ON public."MedicionRespuesta" FOR ALL
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

-- MedicionRespuesta: admins/docentes leen todas las respuestas
CREATE POLICY "Admins y docentes leen respuestas"
  ON public."MedicionRespuesta" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."UserRole"
      WHERE id = auth.uid() AND role IN ('superadmin', 'docente')
    )
  );

-- ================================================
-- Índices
-- ================================================
CREATE INDEX IF NOT EXISTS "idx_medicion_pregunta_bootcamp" ON public."MedicionPregunta"("bootcampId");
CREATE INDEX IF NOT EXISTS "idx_medicion_respuesta_pregunta" ON public."MedicionRespuesta"("preguntaId");
CREATE INDEX IF NOT EXISTS "idx_medicion_respuesta_user" ON public."MedicionRespuesta"("userId");
