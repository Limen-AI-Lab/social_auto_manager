-- SAMA: Allow both admin and super_admin to manage business_units.
-- Run after 20250203100000_drop_business_units_type.sql

drop policy if exists "Super admin manage business_units" on public.business_units;

create policy "Admin and super_admin manage business_units"
  on public.business_units for all
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin')
  );
