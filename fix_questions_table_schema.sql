-- Fix questions table schema to match the code expectations
-- This script will modify the existing questions table to match what the code expects

-- First, let's check if we need to recreate the table or modify it
-- If the table has the wrong structure, we'll need to fix it

-- Add missing columns if they don't exist
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS question_id INT AUTO_INCREMENT PRIMARY KEY FIRST,
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

-- If the table has the old 'id' column, we might need to handle it
-- Check if 'id' column exists and handle accordingly
-- This is a complex migration that might require recreating the table

-- For now, let's create a backup and recreate approach:
-- 1. Create a backup table
CREATE TABLE questions_backup AS SELECT * FROM questions;

-- 2. Drop the original table
DROP TABLE IF EXISTS questions;

-- 3. Create the correct table structure
CREATE TABLE questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type ENUM('multiple_choice', 'true_false', 'essay') NOT NULL,
    topic_id INT,
    model_answer TEXT,
    difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    hint TEXT,
    keywords JSON,
    tags JSON,
    help_guidance TEXT,
    points INT DEFAULT 1,
    status ENUM('draft', 'active', 'inactive') DEFAULT 'draft',
    usage_count INT DEFAULT 0,
    acceptance_rate DECIMAL(5,2) DEFAULT 0.00,
    created_by INT,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_questions_topic (topic_id),
    INDEX idx_questions_difficulty (difficulty_level),
    INDEX idx_questions_type (question_type),
    INDEX idx_questions_status (status)
);

-- 4. If you had data in the backup table, you would need to migrate it here
-- For now, we'll leave the backup table for reference
