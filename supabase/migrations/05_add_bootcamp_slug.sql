-- Add slug column to Bootcamp table
alter table "Bootcamp" 
add column if not exists slug text unique;

-- Optional: Backfill slugs for existing bootcamps (simple version, assuming unique titles or just id based)
-- For a real prod system we'd be more careful, but for this dev stage:
update "Bootcamp" set slug = lower(replace(title, ' ', '-')) where slug is null;
