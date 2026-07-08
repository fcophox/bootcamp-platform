-- Update Lesson table to support 'check' content type
-- Drop existing constraint
alter table "Lesson" drop constraint if exists "Lesson_type_check";

-- Add the new constraint with check included
alter table "Lesson" add constraint "Lesson_type_check" 
check (type in ('text', 'video', 'presentation', 'podcast', 'pdf', 'exam', 'check', 'subtitle'));
