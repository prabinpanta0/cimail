-- Single-user ownership table for Google OAuth login.
-- Run this in Supabase SQL editor (once).

create table if not exists public.mail_app_user (
	-- Enforces exactly one row (singleton pattern)
	singleton boolean primary key default true,
	google_sub text not null,
	email text not null,
	gmail_refresh_token text,
	created_at timestamptz not null default now()
);

alter table if exists public.mail_app_user
	add column if not exists gmail_refresh_token text;

alter table if exists public.mail_app_user enable row level security;

revoke all on table public.mail_app_user from anon;
revoke all on table public.mail_app_user from authenticated;
