-- Add university and grade columns to students table
-- This migration adds university and grade fields to support student registration requirements

-- Add university column
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS university VARCHAR(255) NULL;

-- Add grade column  
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS grade VARCHAR(10) NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_students_university ON students(university);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);

-- Add comments for documentation
ALTER TABLE students MODIFY COLUMN university VARCHAR(255) NULL COMMENT 'University name where student is enrolled';
ALTER TABLE students MODIFY COLUMN grade VARCHAR(10) NULL COMMENT 'Student grade level (1-5)';
