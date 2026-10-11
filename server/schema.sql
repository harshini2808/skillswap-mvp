CREATE DATABASE IF NOT EXISTS skillswap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE skillswap;
CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 department VARCHAR(80) DEFAULT '',
 year_level VARCHAR(20) DEFAULT '',
 bio TEXT,
 availability VARCHAR(160) DEFAULT '',
 credits INT NOT NULL DEFAULT 5,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS skills (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 skill_name VARCHAR(80) NOT NULL,
 skill_type ENUM('teach','learn') NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 UNIQUE KEY unique_user_skill (user_id, skill_name, skill_type)
);
CREATE TABLE IF NOT EXISTS requests (
 id INT AUTO_INCREMENT PRIMARY KEY,
 sender_id INT NOT NULL,
 receiver_id INT NOT NULL,
 offered_skill VARCHAR(80) NOT NULL,
 requested_skill VARCHAR(80) NOT NULL,
 status ENUM('pending','accepted','declined','cancelled') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sessions (
 id INT AUTO_INCREMENT PRIMARY KEY,
 request_id INT NOT NULL UNIQUE,
 scheduled_at DATETIME NULL,
 status ENUM('upcoming','completed','cancelled') NOT NULL DEFAULT 'upcoming',
 completed_at TIMESTAMP NULL,
 FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reviews (
 id INT AUTO_INCREMENT PRIMARY KEY,
 session_id INT NOT NULL,
 reviewer_id INT NOT NULL,
 reviewee_id INT NOT NULL,
 rating TINYINT NOT NULL,
 comment VARCHAR(500) DEFAULT '',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
 FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
 UNIQUE KEY one_review_per_user_session (session_id, reviewer_id),
 CHECK (rating BETWEEN 1 AND 5)
);
CREATE TABLE IF NOT EXISTS credit_transactions (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 session_id INT NULL,
 amount INT NOT NULL,
 description VARCHAR(180) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);
