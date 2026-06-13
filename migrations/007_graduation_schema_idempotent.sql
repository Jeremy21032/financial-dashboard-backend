-- ============================================================================
-- 007_graduation_schema_idempotent.sql
-- Para BD donde las tablas de graduación YA existen (003 u otras migraciones).
--
-- Parte 1: CREATE TABLE IF NOT EXISTS (esquema objetivo; no borra datos).
-- Parte 2: Vistas de resumen.
-- Parte 3: ALTER idempotentes (añade/renombra/elimina columnas según haga falta).
--
-- Ejecutar una vez en phpMyAdmin / consola MySQL del proyecto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PARTE 1 — CREATE IF NOT EXISTS (esquema final)
-- ----------------------------------------------------------------------------

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

-- Abonos: depósitos por CURSO (tabla aparte de gastos)
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

-- Gastos: pagos por ACTIVIDAD (tabla aparte de abonos)
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

-- ----------------------------------------------------------------------------
-- PARTE 2 — Vistas (siempre reemplazables)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW graduation_course_totals AS
SELECT
  gcc.campaign_id,
  gcc.course_id,
  gcc.expected_contribution,
  COALESCE(SUM(gc.amount), 0) AS total_contributed
FROM graduation_campaign_courses gcc
LEFT JOIN graduation_contributions gc
  ON gc.campaign_id = gcc.campaign_id AND gc.course_id = gcc.course_id
GROUP BY gcc.campaign_id, gcc.course_id, gcc.expected_contribution;

CREATE OR REPLACE VIEW graduation_activity_totals AS
SELECT
  ga.id AS activity_id,
  ga.campaign_id,
  ga.name,
  ga.planned_budget,
  ga.sort_order,
  COALESCE(SUM(ge.amount), 0) AS total_spent
FROM graduation_activities ga
LEFT JOIN graduation_expenses ge ON ge.activity_id = ga.id
GROUP BY ga.id, ga.campaign_id, ga.name, ga.planned_budget, ga.sort_order;

-- ----------------------------------------------------------------------------
-- PARTE 3 — ALTER idempotentes (tablas ya creadas con esquema antiguo)
-- Solo ejecuta cada cambio si la columna aún no coincide con el objetivo.
-- ----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS graduation_apply_schema_alters;

DELIMITER $$

CREATE PROCEDURE graduation_apply_schema_alters()
BEGIN
  DECLARE db_name VARCHAR(64);
  SET db_name = DATABASE();

  -- —— graduation_contributions ——
  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_contributions'
        AND COLUMN_NAME = 'receipt_number') = 0 THEN
    ALTER TABLE graduation_contributions
      ADD COLUMN receipt_number VARCHAR(64) NULL AFTER date;
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_contributions'
        AND COLUMN_NAME = 'transfer_motivo') = 0 THEN
    ALTER TABLE graduation_contributions
      ADD COLUMN transfer_motivo VARCHAR(500) NULL AFTER receipt_number;
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_contributions'
        AND COLUMN_NAME = 'reported_by') = 0 THEN
    ALTER TABLE graduation_contributions
      ADD COLUMN reported_by VARCHAR(255) NULL AFTER transfer_motivo;
  END IF;

  -- receipt_image (003 antiguo) → transfer_receipt_image
  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_contributions'
        AND COLUMN_NAME = 'receipt_image') > 0
     AND (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_contributions'
            AND COLUMN_NAME = 'transfer_receipt_image') = 0 THEN
    ALTER TABLE graduation_contributions
      CHANGE COLUMN receipt_image transfer_receipt_image LONGTEXT NULL;
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_contributions'
        AND COLUMN_NAME = 'transfer_receipt_image') = 0 THEN
    ALTER TABLE graduation_contributions
      ADD COLUMN transfer_receipt_image LONGTEXT NULL AFTER reported_by;
  END IF;

  -- —— graduation_expenses ——
  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_expenses'
        AND COLUMN_NAME = 'payment_receipt_image') = 0 THEN
    ALTER TABLE graduation_expenses
      ADD COLUMN payment_receipt_image LONGTEXT NULL AFTER description;
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_expenses'
        AND COLUMN_NAME = 'invoice_images') = 0 THEN
    ALTER TABLE graduation_expenses
      ADD COLUMN invoice_images LONGTEXT NULL AFTER payment_receipt_image;
  END IF;

  -- Columna legacy; no compartir con contributions
  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_expenses'
        AND COLUMN_NAME = 'receipt_images') > 0 THEN
    ALTER TABLE graduation_expenses DROP COLUMN receipt_images;
  END IF;

END$$

DELIMITER ;

CALL graduation_apply_schema_alters();
DROP PROCEDURE IF EXISTS graduation_apply_schema_alters;
