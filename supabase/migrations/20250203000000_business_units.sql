-- SAMA: business_units table for multi-user, multi-device BU list and profile_code
-- Run after 20250202100000_add_super_admin_role.sql

-- 1. business_units: id (PK), type (unique, for content_projects link), label, icon, logo, profile_code
create table if not exists public.business_units (
  id text primary key,
  type text not null unique,
  label text not null,
  icon text not null default 'Building2',
  logo text,
  profile_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. updated_at trigger
drop trigger if exists business_units_updated_at on public.business_units;
create trigger business_units_updated_at
  before update on public.business_units
  for each row execute function public.set_updated_at();

-- 3. RLS
alter table public.business_units enable row level security;

-- All authenticated users can read
create policy "Authenticated read business_units"
  on public.business_units for select
  to authenticated
  using (true);

-- Only super_admin can insert/update/delete
create policy "Super admin manage business_units"
  on public.business_units for all
  to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'super_admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'super_admin');

-- 4. Seed default BUs (match App.tsx defaults)
insert into public.business_units (id, type, label, icon, profile_code)
values
  ('real-estate', 'real-estate', 'Real Estate', 'Building2', null),
  ('immigration', 'immigration', 'Immigration', 'Plane', null),
  ('insurance', 'insurance', 'Insurance', 'ShieldCheck', null),
  ('test-profile', 'tax', 'TESTProfile', 'TestTube', null)
on conflict (id) do nothing;
