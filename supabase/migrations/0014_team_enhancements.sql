-- 0014_team_enhancements.sql
-- Team & Users module enhancements.
-- Adds job_title, department to users (profile enrichment).
-- Adds description and color to roles (custom role UX).
-- All safe to run on existing data (IF NOT EXISTS / DEFAULT).

alter table public.users
  add column if not exists job_title   text,
  add column if not exists department  text;

alter table public.roles
  add column if not exists description text,
  add column if not exists color       text default '#6b7280';
