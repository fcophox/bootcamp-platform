-- Add icon and color columns to Bootcamp table
alter table "Bootcamp" 
add column if not exists icon text default 'code',
add column if not exists color text default 'green';
