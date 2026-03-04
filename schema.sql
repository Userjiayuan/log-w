CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (email, password_hash, display_name)
VALUES (
  'demo@example.com',
  '$2a$10$R5lSxqkYQ3ZoMcu37EHo5u9b8r0SxV0FYX1T2uC6mQcm6ApZgqU7C',
  '演示用户'
);
