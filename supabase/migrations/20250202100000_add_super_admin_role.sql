-- Allow super_admin in profiles.role (run after 20250202000000_auth_and_projects.sql)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('super_admin', 'admin', 'editor', 'viewer'));
