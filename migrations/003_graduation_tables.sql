-- Dashboard de Graduación (multi-curso)
-- Ejecutar una vez en MySQL.

CREATE TABLE IF NOT EXISTS graduation_campaigns (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  academic_year VARCHAR(32) NOT NULL,
  expected_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graduation_campaign_courses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED NOT NULL,
  course_id INT NOT NULL,
  expected_contribution DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_campaign_course (campaign_id, course_id),
  KEY idx_campaign (campaign_id),
  KEY idx_course (course_id),
  CONSTRAINT fk_gcc_campaign FOREIGN KEY (campaign_id) REFERENCES graduation_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_gcc_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graduation_activities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  planned_budget DECIMAL(12,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_campaign (campaign_id),
  CONSTRAINT fk_ga_campaign FOREIGN KEY (campaign_id) REFERENCES graduation_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Abonos: depósitos por CURSO (solo comprobante de transferencia)
CREATE TABLE IF NOT EXISTS graduation_contributions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED NOT NULL,
  course_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL,
  receipt_number VARCHAR(64) NULL,
  transfer_motivo VARCHAR(500) NULL,
  reported_by VARCHAR(255) NULL,
  transfer_receipt_image LONGTEXT NULL,
  notes TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Registrado',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_campaign (campaign_id),
  KEY idx_course (course_id),
  KEY idx_date (date),
  CONSTRAINT fk_gc_campaign FOREIGN KEY (campaign_id) REFERENCES graduation_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_gc_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gastos: pagos por ACTIVIDAD (comprobante de pago + facturas) — tabla aparte de contributions
CREATE TABLE IF NOT EXISTS graduation_expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED NOT NULL,
  activity_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT NULL,
  payment_receipt_image LONGTEXT NULL,
  invoice_images LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_campaign (campaign_id),
  KEY idx_activity (activity_id),
  KEY idx_date (date),
  CONSTRAINT fk_ge_campaign FOREIGN KEY (campaign_id) REFERENCES graduation_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_ge_activity FOREIGN KEY (activity_id) REFERENCES graduation_activities(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuarios y roles (fase auth)
CREATE TABLE IF NOT EXISTS graduation_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graduation_user_roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  campaign_id INT UNSIGNED NOT NULL,
  role ENUM('graduation_admin', 'course_delegate', 'readonly') NOT NULL,
  course_id INT NULL,
  UNIQUE KEY uq_user_campaign_role (user_id, campaign_id, role, course_id),
  CONSTRAINT fk_gur_user FOREIGN KEY (user_id) REFERENCES graduation_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_gur_campaign FOREIGN KEY (campaign_id) REFERENCES graduation_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
