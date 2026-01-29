-- Add local state columns to mail_messages table
-- Run this in Supabase SQL editor

-- Add local action columns
ALTER TABLE public.mail_messages 
ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_trashed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS mail_messages_starred_idx ON public.mail_messages (is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS mail_messages_trashed_idx ON public.mail_messages (is_trashed) WHERE is_trashed = true;
CREATE INDEX IF NOT EXISTS mail_messages_archived_idx ON public.mail_messages (is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS mail_messages_read_idx ON public.mail_messages (is_read);
