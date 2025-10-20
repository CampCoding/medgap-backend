-- Add missing columns to questions table for hint and help_guidance
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS hint TEXT,
ADD COLUMN IF NOT EXISTS help_guidance TEXT;
