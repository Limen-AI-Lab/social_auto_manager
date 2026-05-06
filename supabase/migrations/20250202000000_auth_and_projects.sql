-- SAMA: Auth profiles and content_projects with RLS
-- Run in Dashboard SQL Editor or via CLI migrate

-- 1. profiles: one per auth user, holds display_name and role
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. content_projects: persisted ContentProject per user
create table if not exists public.content_projects (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  video_name text not null,
  upload_date text not null,
  business_unit text not null,
  status text not null default 'ready' check (status in ('processing', 'ready', 'published', 'failed')),
  thumbnail_url text not null default '',
  source_cover_url text,
  video_url text,
  generated_content jsonb not null default '[]',
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  views integer default 0
);

create index if not exists content_projects_owner_id on public.content_projects(owner_id);
create index if not exists content_projects_created_at on public.content_projects(created_at desc);

-- 3. Trigger: create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'email', new.email),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::text, 'viewer')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. RLS: profiles
alter table public.profiles enable row level security;

-- All authenticated users can read all profiles (single-tenant team list)
create policy "Authenticated read profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Only admins can insert/update/delete profiles (enforced in app; here we allow authenticated to write for simplicity; app hides UI for non-admin)
create policy "Authenticated manage profiles"
  on public.profiles for all
  to authenticated
  using (true)
  with check (true);

-- 5. RLS: content_projects
alter table public.content_projects enable row level security;

create policy "Users read own projects"
  on public.content_projects for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Users insert own projects"
  on public.content_projects for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Users update own projects"
  on public.content_projects for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users delete own projects"
  on public.content_projects for delete
  to authenticated
  using (auth.uid() = owner_id);

-- 6. updated_at trigger for profiles
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists content_projects_updated_at on public.content_projects;
create trigger content_projects_updated_at
  before update on public.content_projects
  for each row execute function public.set_updated_at();
