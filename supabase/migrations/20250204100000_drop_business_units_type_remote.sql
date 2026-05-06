-- SAMA: Drop type column from business_units (fix for remote DB that still has it).
-- Safe to run: drop column if exists type.

alter table if exists public.business_units drop column if exists type;
