-- Database Schema for Exam Management System
-- Based on the React component structure

-- =============================================
-- SUBJECTS AND CURRICULUM TABLES
-- =============================================

-- Subjects table
CREATE TABLE subjects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Units table (subjects are divided into units)
CREATE TABLE units (
    id VARCHAR(50) PRIMARY KEY,
    subject_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    INDEX idx_units_subject (subject_id)
);

-- Topics table (units are divided into topics)
CREATE TABLE topics (
    id VARCHAR(50) PRIMARY KEY,
    unit_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
    INDEX idx_topics_unit (unit_id)
);

-- =============================================
-- QUESTIONS TABLE
-- =============================================

-- Questions table
CREATE TABLE questions (
    id VARCHAR(50) PRIMARY KEY,
    topic_id VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('multiple-choice', 'short-answer', 'essay', 'calculation', 'graphing', 'true-false') NOT NULL,
    difficulty ENUM('easy', 'medium', 'hard', 'expert') NOT NULL,
    points INT DEFAULT 1,
    time_limit INT DEFAULT 60, -- in seconds
    explanation TEXT,
    metadata JSON, -- for storing additional question-specific data
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_questions_topic (topic_id),
    INDEX idx_questions_difficulty (difficulty),
    INDEX idx_questions_type (question_type),
    INDEX idx_questions_active (is_active)
);

-- Question options for multiple choice questions
CREATE TABLE question_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id VARCHAR(50) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    INDEX idx_options_question (question_id)
);

-- =============================================
-- EXAMS TABLE
-- =============================================

-- Main exams table
CREATE TABLE exams (
    exam_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subject_id VARCHAR(50) NOT NULL,
    teacher_id VARCHAR(50) NOT NULL,
    difficulty ENUM('easy', 'medium', 'hard', 'expert') NOT NULL,
    duration INT NOT NULL, -- in minutes
    total_points INT DEFAULT 0,
    passing_score INT DEFAULT 0,
    status ENUM('draft', 'published', 'scheduled', 'completed', 'cancelled') DEFAULT 'draft',
    scheduled_date DATETIME,
    start_date DATETIME,
    end_date DATETIME,
    instructions TEXT,
    settings JSON, -- for storing exam-specific settings
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- EXAM QUESTIONS RELATIONSHIP TABLE
-- =============================================

-- Junction table for exam questions
CREATE TABLE exam_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id VARCHAR(50) NOT NULL,
    question_id VARCHAR(50) NOT NULL,
    order_index INT DEFAULT 0,
    points INT DEFAULT 1, -- can override question's default points
    time_limit INT, -- can override question's default time limit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_exam_question (exam_id, question_id)
);

-- =============================================
-- EXAM SESSIONS AND ATTEMPTS
-- =============================================

-- Exam attempts by students
CREATE TABLE exam_attempts (
    id VARCHAR(50) PRIMARY KEY,
    exam_id VARCHAR(50) NOT NULL,
    student_id VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    time_spent INT DEFAULT 0, -- in seconds
    total_score INT DEFAULT 0,
    status ENUM('in_progress', 'submitted', 'abandoned', 'timeout') DEFAULT 'in_progress',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    INDEX idx_attempts_exam (exam_id),
    INDEX idx_attempts_student (student_id),
    INDEX idx_attempts_status (status)
);

-- Student answers for each question
CREATE TABLE exam_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id VARCHAR(50) NOT NULL,
    exam_question_id INT NOT NULL,
    answer_text TEXT,
    selected_option_id INT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    points_earned INT DEFAULT 0,
    time_spent INT DEFAULT 0, -- in seconds
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_question_id) REFERENCES exam_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL,
    UNIQUE KEY unique_attempt_question (attempt_id, exam_question_id),
    INDEX idx_answers_attempt (attempt_id),
    INDEX idx_answers_exam_question (exam_question_id)
);

-- =============================================
-- SAMPLE DATA INSERTION
-- =============================================

-- Insert sample subjects
INSERT INTO subjects (id, name, description, icon) VALUES
('mathematics', 'Mathematics', 'Mathematical concepts and problem solving', '📐'),
('physics', 'Physics', 'Physical sciences and natural laws', '⚛️'),
('biology', 'Biology', 'Life sciences and living organisms', '🧬'),
('chemistry', 'Chemistry', 'Chemical reactions and properties', '🧪'),
('english', 'English', 'Language arts and literature', '📚');

-- Insert sample units for Mathematics
INSERT INTO units (id, subject_id, name, description, order_index) VALUES
('math-1', 'mathematics', 'Algebra', 'Linear and quadratic equations, polynomials', 1),
('math-2', 'mathematics', 'Geometry', 'Shapes, angles, and spatial relationships', 2),
('math-3', 'mathematics', 'Calculus', 'Derivatives, integrals, and limits', 3),
('math-4', 'mathematics', 'Statistics', 'Data analysis and probability', 4);

-- Insert sample units for Physics
INSERT INTO units (id, subject_id, name, description, order_index) VALUES
('phy-1', 'physics', 'Classical Mechanics', 'Newton\'s laws, motion, and forces', 1),
('phy-2', 'physics', 'Thermodynamics', 'Heat, energy, and temperature', 2),
('phy-3', 'physics', 'Electromagnetism', 'Electric and magnetic fields', 3),
('phy-4', 'physics', 'Quantum Physics', 'Quantum mechanics and particles', 4);

-- Insert sample topics for Algebra
INSERT INTO topics (id, unit_id, name, description, order_index) VALUES
('alg-1', 'math-1', 'Linear Equations', 'Solving linear equations and systems', 1),
('alg-2', 'math-1', 'Quadratic Functions', 'Parabolas, vertex, and roots', 2),
('alg-3', 'math-1', 'Polynomials', 'Polynomial operations and factoring', 3);

-- Insert sample topics for Classical Mechanics
INSERT INTO topics (id, unit_id, name, description, order_index) VALUES
('mech-1', 'phy-1', 'Newton\'s Laws', 'Force, mass, and acceleration', 1),
('mech-2', 'phy-1', 'Energy & Work', 'Kinetic and potential energy', 2),
('mech-3', 'phy-1', 'Momentum', 'Linear momentum and collisions', 3);

-- Insert sample questions
INSERT INTO questions (id, topic_id, question_text, question_type, difficulty, points, explanation, created_by) VALUES
('q1', 'alg-1', 'Solve for x: 2x + 5 = 13', 'multiple-choice', 'easy', 1, 'Subtract 5 from both sides, then divide by 2', 'system'),
('q2', 'alg-1', 'Find the slope of the line passing through (2,3) and (4,7)', 'true-false', 'medium', 2, 'Use the slope formula: (y2-y1)/(x2-x1)', 'system'),
('q3', 'alg-1', 'Solve the system: x + y = 5, 2x - y = 1', 'multiple-choice', 'medium', 2, 'Use substitution or elimination method', 'system'),
('q4', 'alg-1', 'Graph the inequality: y ≤ 2x + 3', 'graphing', 'hard', 3, 'Draw the line y = 2x + 3 and shade below it', 'system'),
('q8', 'mech-1', 'A 5kg object accelerates at 2m/s². What is the net force?', 'calculation', 'easy', 2, 'Use F = ma: F = 5kg × 2m/s² = 10N', 'system'),
('q9', 'mech-1', 'Explain Newton\'s Third Law with an example', 'essay', 'medium', 3, 'For every action, there is an equal and opposite reaction', 'system'),
('q10', 'mech-1', 'Calculate the friction force on a 10kg block on a surface with μ = 0.3', 'calculation', 'hard', 4, 'F_friction = μ × N = μ × mg', 'system');

-- Insert sample question options for multiple choice questions
INSERT INTO question_options (question_id, option_text, is_correct, order_index) VALUES
('q1', 'x = 4', TRUE, 1),
('q1', 'x = 3', FALSE, 2),
('q1', 'x = 5', FALSE, 3),
('q1', 'x = 6', FALSE, 4),
('q2', 'The slope is 2', TRUE, 1),
('q2', 'The slope is 4', FALSE, 2),
('q3', 'x = 2, y = 3', TRUE, 1),
('q3', 'x = 3, y = 2', FALSE, 2),
('q3', 'x = 1, y = 4', FALSE, 3),
('q3', 'x = 4, y = 1', FALSE, 4);

-- =============================================
-- USEFUL VIEWS
-- =============================================

-- View for exam details with subject information
CREATE VIEW exam_details AS
SELECT 
    e.id,
    e.title,
    s.name as subject_name,
    e.difficulty,
    e.duration,
    e.total_points,
    e.status,
    e.scheduled_date,
    e.created_by,
    e.created_at,
    COUNT(eq.question_id) as question_count
FROM exams e
JOIN subjects s ON e.subject_id = s.id
LEFT JOIN exam_questions eq ON e.id = eq.exam_id
GROUP BY e.id, e.title, s.name, e.difficulty, e.duration, e.total_points, e.status, e.scheduled_date, e.created_by, e.created_at;

-- View for question details with topic and subject information
CREATE VIEW question_details AS
SELECT 
    q.id,
    q.question_text,
    q.question_type,
    q.difficulty,
    q.points,
    t.name as topic_name,
    u.name as unit_name,
    s.name as subject_name,
    q.created_at
FROM questions q
JOIN topics t ON q.topic_id = t.id
JOIN units u ON t.unit_id = u.id
JOIN subjects s ON u.subject_id = s.id
WHERE q.is_active = TRUE;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Additional indexes for better query performance
CREATE INDEX idx_exams_created_at ON exams(created_at);
CREATE INDEX idx_questions_created_at ON questions(created_at);
CREATE INDEX idx_attempts_started_at ON exam_attempts(started_at);
CREATE INDEX idx_answers_answered_at ON exam_answers(answered_at);

-- Composite indexes for common queries
CREATE INDEX idx_exam_questions_exam_order ON exam_questions(exam_id, order_index);
CREATE INDEX idx_questions_topic_difficulty ON questions(topic_id, difficulty);
CREATE INDEX idx_attempts_exam_student ON exam_attempts(exam_id, student_id);
