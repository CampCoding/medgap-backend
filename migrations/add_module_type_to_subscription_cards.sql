-- Alter subscription_cards table to add 'module' type
-- This migration adds 'module' to the ENUM type column

ALTER TABLE subscription_cards 
MODIFY COLUMN type ENUM('book', 'topic', 'exam', 'module') NOT NULL;

