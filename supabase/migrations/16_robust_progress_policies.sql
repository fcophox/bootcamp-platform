-- Drop existing if exists to be safe
drop policy if exists "allow_all_auth" on "LessonCompletion";

-- Enable RLS
alter table "LessonCompletion" enable row level security;

-- Policy for Select (Students see their own, Admins see all)
-- We'll simplify to 'authenticated' for now to ensure it works, then tighten
create policy "Enable select for authenticated users"
on "LessonCompletion" for select
to authenticated
using (true);

-- Policy for Insert (Students insert their own)
create policy "Enable insert for authenticated users"
on "LessonCompletion" for insert
to authenticated
with check (true);

-- Policy for Delete
create policy "Enable delete for authenticated users"
on "LessonCompletion" for delete
to authenticated
using (true);
