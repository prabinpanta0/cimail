-- Add is_draft column to mail_messages table
-- Run this in Supabase SQL editor

ALTER TABLE public.mail_messages 
ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- Create index for drafts
CREATE INDEX IF NOT EXISTS mail_messages_draft_idx 
ON public.mail_messages (is_draft) 
WHERE is_draft = true;
