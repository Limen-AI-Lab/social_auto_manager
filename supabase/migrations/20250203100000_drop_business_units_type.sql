-- SAMA: drop type column from business_units; id is the sole identifier.
-- Run after 20250203000000_business_units.sql

alter table if exists public.business_units drop column if exists type;
