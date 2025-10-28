-- Add missing column `plan_id` to `qbank` table
ALTER TABLE qbank
ADD COLUMN IF NOT EXISTS plan_id INT DEFAULT 0;
