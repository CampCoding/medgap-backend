-- Simple fix: Add missing columns to existing questions table
-- This assumes the table already has question_id as primary key

-- Add missing columns if they don't exist
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS hint TEXT,
ADD COLUMN IF NOT EXISTS help_guidance TEXT,
ADD COLUMN IF NOT EXISTS keywords JSON,
ADD COLUMN IF NOT EXISTS tags JSON,
ADD COLUMN IF NOT EXISTS model_answer TEXT,
ADD COLUMN IF NOT EXISTS status ENUM('draft', 'active', 'inactive') DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS acceptance_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS created_by INT,
ADD COLUMN IF NOT EXISTS updated_by INT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Rename difficulty to difficulty_level if it exists
ALTER TABLE questions 
CHANGE COLUMN difficulty difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium';

-- Update question_type enum values to match code expectations
ALTER TABLE questions 
MODIFY COLUMN question_type ENUM('multiple_choice', 'true_false', 'essay') NOT NULL;
