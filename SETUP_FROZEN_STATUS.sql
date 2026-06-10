-- MIGRACIÓN SQL PARA PERMITIR EL ESTADO 'frozen' EN BootcampStudent
-- Copia y ejecuta este script en el SQL Editor de tu panel de Supabase.

-- 1. Eliminar la restricción de check existente (normalmente se llama BootcampStudent_status_check)
ALTER TABLE public."BootcampStudent" DROP CONSTRAINT IF EXISTS "BootcampStudent_status_check";

-- 2. Agregar la nueva restricción de check que incluye 'frozen'
ALTER TABLE public."BootcampStudent" 
  ADD CONSTRAINT "BootcampStudent_status_check" 
  CHECK (status IN ('invited', 'active', 'completed', 'frozen'));

-- 3. Agregar columna enableRanking a la tabla Bootcamp (si no existe)
ALTER TABLE public."Bootcamp" ADD COLUMN IF NOT EXISTS "enableRanking" BOOLEAN DEFAULT true;
