-- Add attachments column to mail_messages table
-- Run this in Supabase SQL editor

-- Add attachments column (stores metadata, not the actual files)
ALTER TABLE public.mail_messages 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Allow public read access" ON storage.objects 
FOR SELECT USING (bucket_id = 'email-attachments');

CREATE POLICY "Allow authenticated uploads" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'email-attachments');

CREATE POLICY "Allow authenticated deletes" ON storage.objects 
FOR DELETE USING (bucket_id = 'email-attachments');
