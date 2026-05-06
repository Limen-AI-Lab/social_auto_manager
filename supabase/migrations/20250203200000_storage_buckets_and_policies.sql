-- SAMA: Storage buckets (videos, thumbnails) and RLS policies
-- Fixes: "new row violates row-level security policy" on upload

-- 1. Create buckets (public for direct URL access)
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true), ('thumbnails', 'thumbnails', true)
on conflict (id) do update set public = true;

-- 2. Drop existing policies if present (idempotent)
drop policy if exists "Public read for videos and thumbnails" on storage.objects;
drop policy if exists "Allow uploads for videos and thumbnails" on storage.objects;

-- 3. Public read: anyone can SELECT objects from these buckets (for public URLs)
create policy "Public read for videos and thumbnails"
on storage.objects for select
using (bucket_id in ('videos', 'thumbnails'));

-- 4. Allow uploads: anon and authenticated can INSERT into these buckets
create policy "Allow uploads for videos and thumbnails"
on storage.objects for insert
to anon, authenticated
with check (bucket_id in ('videos', 'thumbnails'));
