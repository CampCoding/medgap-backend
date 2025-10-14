-- Create exam_attempts table
CREATE TABLE IF NOT EXISTS exam_attempts (
    exam_attempt_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    student_id INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    time_spent INT DEFAULT 0, -- in seconds
    total_score INT DEFAULT 0,
    status ENUM('in_progress', 'submitted', 'abandoned', 'timeout') DEFAULT 'in_progress',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_attempts_exam (exam_id),
    INDEX idx_attempts_student (student_id),
    INDEX idx_attempts_status (status)
);

-- Create exam_answers table
CREATE TABLE IF NOT EXISTS exam_answers (
    exam_answer_id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    exam_question_id INT NOT NULL,
    answer_text TEXT,
    selected_option_id INT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    points_earned INT DEFAULT 0,
    time_spent INT DEFAULT 0, -- in seconds
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES exam_attempts(exam_attempt_id) ON DELETE CASCADE,
    FOREIGN KEY (exam_question_id) REFERENCES exam_questions(exam_question_id) ON DELETE CASCADE,
    FOREIGN KEY (selected_option_id) REFERENCES question_options(option_id) ON DELETE SET NULL,
    UNIQUE KEY unique_attempt_question (attempt_id, exam_question_id),
    INDEX idx_answers_attempt (attempt_id),
    INDEX idx_answers_exam_question (exam_question_id)
);

-- Update exam_questions table to have proper primary key
ALTER TABLE exam_questions 
ADD COLUMN IF NOT EXISTS exam_question_id INT AUTO_INCREMENT PRIMARY KEY FIRST;

-- Add missing columns to exams table if they don't exist
ALTER TABLE exams 
ADD COLUMN IF NOT EXISTS scheduled_date DATETIME,
ADD COLUMN IF NOT EXISTS start_date DATETIME,
ADD COLUMN IF NOT EXISTS end_date DATETIME,
ADD COLUMN IF NOT EXISTS instructions TEXT,
ADD COLUMN IF NOT EXISTS settings JSON;

-- Add missing columns to questions table if they don't exist
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS model_answer TEXT,
ADD COLUMN IF NOT EXISTS keywords JSON,
ADD COLUMN IF NOT EXISTS tags JSON,
ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive') DEFAULT 'active';

-- Add missing columns to question_options table if they don't exist
ALTER TABLE question_options 
ADD COLUMN IF NOT EXISTS explanation TEXT;

-- Create student_enrollments table if it doesn't exist
CREATE TABLE IF NOT EXISTS student_enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    module_id INT NOT NULL,
    status ENUM('active', 'inactive', 'completed') DEFAULT 'active',
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_enrollments_student (student_id),
    INDEX idx_enrollments_module (module_id),
    UNIQUE KEY unique_student_module (student_id, module_id)
);

-- Create student_mark_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS student_mark_categories (
    student_mark_category_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_categories_student (student_id)
);

-- Create question_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS question_notes (
    question_note_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    question_id INT NOT NULL,
    qbank_id INT,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notes_student (student_id),
    INDEX idx_notes_question (question_id)
);

-- Create mark_category_question table if it doesn't exist
CREATE TABLE IF NOT EXISTS mark_category_question (
    mark_category_question_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    qbank_id INT,
    category_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES student_mark_categories(student_mark_category_id) ON DELETE CASCADE,
    INDEX idx_mark_question (question_id),
    INDEX idx_mark_category (category_id)
);

-- Create student_deck table if it doesn't exist
CREATE TABLE IF NOT EXISTS student_deck (
    student_deck_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    deck_title VARCHAR(255) NOT NULL,
    deck_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_deck_student (student_id)
);

-- Create student_flash_cards table if it doesn't exist
CREATE TABLE IF NOT EXISTS student_flash_cards (
    student_flash_card_id INT AUTO_INCREMENT PRIMARY KEY,
    student_flash_card_front TEXT NOT NULL,
    student_flash_card_back TEXT NOT NULL,
    deck_id INT NOT NULL,
    tags JSON,
    card_status ENUM('not_seen', 'seen', 'review') DEFAULT 'not_seen',
    card_solved ENUM('0', '1') DEFAULT '0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    solved_at TIMESTAMP NULL,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    question_id INT DEFAULT 0,
    qbank_id INT DEFAULT 0,
    ease_factor DECIMAL(3,2) DEFAULT 2.50,
    repetitions INT DEFAULT 0,
    interval_days INT DEFAULT 0,
    last_reviewed TIMESTAMP NULL,
    next_review TIMESTAMP NULL,
    FOREIGN KEY (deck_id) REFERENCES student_deck(student_deck_id) ON DELETE CASCADE,
    INDEX idx_flashcards_deck (deck_id),
    INDEX idx_flashcards_question (question_id)
);

-- Create solved_questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS solved_questions (
    solved_question_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    student_id INT NOT NULL,
    answer TEXT,
    is_correct ENUM('0', '1') DEFAULT '0',
    qbank_id INT,
    solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_solved_question (question_id),
    INDEX idx_solved_student (student_id)
);

-- Create qbank table if it doesn't exist
CREATE TABLE IF NOT EXISTS qbank (
    qbank_id INT AUTO_INCREMENT PRIMARY KEY,
    qbank_name TEXT NOT NULL,
    tutor_mode ENUM('0', '1') DEFAULT '0',
    timed ENUM('0', '1') DEFAULT '0',
    time_type ENUM('extended', 'fast', 'challenging', 'none') DEFAULT 'none',
    active ENUM('0', '1') DEFAULT '1',
    deleted ENUM('0', '1') DEFAULT '0',
    student_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_qbank_student (student_id)
);

-- Create qbank_questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS qbank_questions (
    qbank_question_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    qbank_id INT NOT NULL,
    correct_option TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (qbank_id) REFERENCES qbank(qbank_id) ON DELETE CASCADE,
    INDEX idx_qbank_questions_qbank (qbank_id),
    INDEX idx_qbank_questions_question (question_id)
);

-- Create annotations table for ebook notes if it doesn't exist
CREATE TABLE IF NOT EXISTS annotations (
    ann_id INT AUTO_INCREMENT PRIMARY KEY,
    ann_value LONGTEXT NOT NULL,
    book_id INT NOT NULL,
    student_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_book_student (book_id, student_id),
    INDEX idx_annotations_book (book_id),
    INDEX idx_annotations_student (student_id)
);