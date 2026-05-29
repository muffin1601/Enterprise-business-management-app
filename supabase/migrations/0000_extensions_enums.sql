-- 0000_extensions_enums.sql
-- Module 0/1 foundation: extensions, app schema, and the enums used by the
-- identity domain (DATABASE_SCHEMA.md §2.1). Enums for other domains are added
-- by their own modules' migrations.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- trigram search (later modules)

create schema if not exists app;

do $$ begin
  create type public.record_status as enum ('active','inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_action as enum
    ('insert','update','delete','restore','login','permission_change');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.currency_code as enum ('INR','USD','EUR','CNY');
exception when duplicate_object then null; end $$;
