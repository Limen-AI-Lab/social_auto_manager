-- SAMA: profile_business_units for editor/viewer BU visibility; content_projects RLS by role and BU

-- 1. profile_business_units: which BUs an editor/viewer can see
create table if not exists public.profile_business_units (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  business_unit_id text not null references public.business_units(id) on delete cascade,
  primary key (profile_id, business_unit_id)
);

create index if not exists profile_business_units_profile_id on public.profile_business_units(profile_id);

-- 2. RLS: profile_business_units
alter table public.profile_business_units enable row level security;

-- Users read own; super_admin/admin read all (for Team page)
create policy "Read own or admin read all profile_business_units"
  on public.profile_business_units for select
  to authenticated
  using (
    profile_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin')
  );

-- Only super_admin and admin can insert/update/delete (assign BUs to editor/viewer)
create policy "Admin manage profile_business_units"
  on public.profile_business_units for all
  to authenticated
  using ((select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin'))
  with check ((select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin'));

-- 3. Index on content_projects.business_unit for RLS filter
create index if not exists content_projects_business_unit on public.content_projects(business_unit);

-- 4. content_projects: drop old RLS policies
drop policy if exists "Users read own projects" on public.content_projects;
drop policy if exists "Users insert own projects" on public.content_projects;
drop policy if exists "Users update own projects" on public.content_projects;
drop policy if exists "Users delete own projects" on public.content_projects;

-- 5. content_projects: new SELECT policy (super_admin/admin all; editor/viewer only allowed BUs)
create policy "Content projects select by role and BU"
  on public.content_projects for select
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin')
    or (
      (select role from public.profiles where id = auth.uid()) in ('editor', 'viewer')
      and business_unit in (
        select business_unit_id from public.profile_business_units where profile_id = auth.uid()
      )
    )
  );

-- 6. content_projects: INSERT (super_admin/admin any with owner; editor only in allowed BU and owner = self; viewer none)
create policy "Content projects insert by role and BU"
  on public.content_projects for insert
  to authenticated
  with check (
    (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin')
    or (
      (select role from public.profiles where id = auth.uid()) = 'editor'
      and owner_id = auth.uid()
      and business_unit in (
        select business_unit_id from public.profile_business_units where profile_id = auth.uid()
      )
    )
  );

-- 7. content_projects: UPDATE (super_admin/admin any; editor only rows in allowed BU; viewer none)
create policy "Content projects update by role and BU"
  on public.content_projects for update
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin')
    or (
      (select role from public.profiles where id = auth.uid()) = 'editor'
      and business_unit in (
        select business_unit_id from public.profile_business_units where profile_id = auth.uid()
      )
    )
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin')
    or (
      (select role from public.profiles where id = auth.uid()) = 'editor'
      and business_unit in (
        select business_unit_id from public.profile_business_units where profile_id = auth.uid()
      )
    )
  );

-- 8. content_projects: DELETE (super_admin/admin any; editor only rows in allowed BU; viewer none)
create policy "Content projects delete by role and BU"
  on public.content_projects for delete
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin')
    or (
      (select role from public.profiles where id = auth.uid()) = 'editor'
      and business_unit in (
        select business_unit_id from public.profile_business_units where profile_id = auth.uid()
      )
    )
  );
