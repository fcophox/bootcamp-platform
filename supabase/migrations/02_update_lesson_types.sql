-- Update Lesson table to support new content types
-- First drop the existing check constraint
alter table "Lesson" drop constraint if exists "Lesson_type_check";

-- Add the new constraint with podcast and pdf included
alter table "Lesson" add constraint "Lesson_type_check" 
check (type in ('text', 'video', 'presentation', 'podcast', 'pdf'));
