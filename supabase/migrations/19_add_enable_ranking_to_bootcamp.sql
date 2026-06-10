-- Migration to add enableRanking column to Bootcamp table
ALTER TABLE "Bootcamp" ADD COLUMN "enableRanking" BOOLEAN DEFAULT true;
