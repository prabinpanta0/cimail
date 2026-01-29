-- Minimal schema for a single-user Gmail-like client with open-tracking.
-- Apply this in Supabase SQL editor.

create table if not exists public.mail_messages (
	id uuid primary key default gen_random_uuid(),
	gmail_message_id text unique,
	gmail_thread_id text,
	account text not null check (account in ('me', 'noreply')),
	direction text not null check (direction in ('inbound', 'outbound')),
	from_email text,
	to_emails jsonb,
	cc_emails jsonb,
	bcc_emails jsonb,
	subject text,
	snippet text,
	body_text text,
	body_html text,
	label_ids text[],
	internal_date timestamptz,
	created_at timestamptz not null default now()
);

create index if not exists mail_messages_thread_idx on public.mail_messages (gmail_thread_id);
create index if not exists mail_messages_internal_date_idx on public.mail_messages (internal_date desc);

create table if not exists public.mail_tracking (
	id uuid primary key default gen_random_uuid(),
	mail_message_id uuid references public.mail_messages(id) on delete cascade,
	created_at timestamptz not null default now()
);

create table if not exists public.mail_opens (
	id bigint generated always as identity primary key,
	tracking_id uuid not null references public.mail_tracking(id) on delete cascade,
	opened_at timestamptz not null default now(),
	ip_hash text,
	user_agent text
);

create index if not exists mail_opens_tracking_idx on public.mail_opens (tracking_id, opened_at desc);

create table if not exists public.mail_sync_state (
	account text primary key,
	next_page_token text,
	updated_at timestamptz not null default now()
);
