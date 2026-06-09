-- Migration to add enableChecklist column to Bootcamp table
ALTER TABLE "Bootcamp" ADD COLUMN "enableChecklist" BOOLEAN DEFAULT true;
