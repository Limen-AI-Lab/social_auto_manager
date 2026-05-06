-- Create Storage buckets for SAMA (videos + thumbnails).
-- Run this in Supabase Dashboard → SQL Editor.

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true), ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Optional: allow public read and anon upload for these buckets.
-- Run only if your project does not already have suitable storage policies.

-- create policy "Public read for videos and thumbnails"
-- on storage.objects for select
-- using (bucket_id in ('videos', 'thumbnails'));

-- create policy "Allow anon upload for videos and thumbnails"
-- on storage.objects for insert
-- with check (bucket_id in ('videos', 'thumbnails'));
