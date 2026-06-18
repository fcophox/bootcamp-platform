-- Add imageUrl column to Bootcamp table
ALTER TABLE "Bootcamp" ADD COLUMN IF NOT EXISTS "imageUrl" text;
