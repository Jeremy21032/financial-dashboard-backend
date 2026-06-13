-- Contratos con proveedores (pedidos realizados) + vínculo en gastos
-- Ejecutar después de 007.

-- ----------------------------------------------------------------------------
-- CREATE IF NOT EXISTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS graduation_contracts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NULL COMMENT 'Ej. HELIO',
  vendor_name VARCHAR(255) NULL,
  deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Abono / anticipo',
  payment_method VARCHAR(255) NULL,
  payment_reference VARCHAR(128) NULL COMMENT 'Nº comprobante transferencia',
  delivery_date DATE NULL,
  delivery_note VARCHAR(255) NULL COMMENT 'Ej. SRA. DIANA, 29-MAY 10AM',
  status VARCHAR(32) NOT NULL DEFAULT 'abierto',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_campaign (campaign_id),
  KEY idx_status (status),
  CONSTRAINT fk_gct_campaign FOREIGN KEY (campaign_id) REFERENCES graduation_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graduation_contract_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contract_id INT UNSIGNED NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_contract (contract_id),
  CONSTRAINT fk_gci_contract FOREIGN KEY (contract_id) REFERENCES graduation_contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- ALTER idempotente (tablas ya existentes)
-- ----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS graduation_apply_contracts_schema;

DELIMITER $$

CREATE PROCEDURE graduation_apply_contracts_schema()
BEGIN
  DECLARE db_name VARCHAR(64);
  SET db_name = DATABASE();

  IF (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_contracts') = 0 THEN
    CREATE TABLE graduation_contracts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(64) NULL,
      vendor_name VARCHAR(255) NULL,
      deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(255) NULL,
      payment_reference VARCHAR(128) NULL,
      delivery_date DATE NULL,
      delivery_note VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'abierto',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_campaign (campaign_id),
      CONSTRAINT fk_gct_campaign FOREIGN KEY (campaign_id) REFERENCES graduation_campaigns(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_contract_items') = 0 THEN
    CREATE TABLE graduation_contract_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      contract_id INT UNSIGNED NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      KEY idx_contract (contract_id),
      CONSTRAINT fk_gci_contract FOREIGN KEY (contract_id) REFERENCES graduation_contracts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_expenses'
        AND COLUMN_NAME = 'contract_id') = 0 THEN
    ALTER TABLE graduation_expenses
      ADD COLUMN contract_id INT UNSIGNED NULL AFTER campaign_id,
      ADD KEY idx_expense_contract (contract_id);
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_expenses'
        AND CONSTRAINT_NAME = 'fk_ge_contract') = 0 THEN
    ALTER TABLE graduation_expenses
      ADD CONSTRAINT fk_ge_contract FOREIGN KEY (contract_id) REFERENCES graduation_contracts(id) ON DELETE SET NULL;
  END IF;

  -- activity_id opcional si el gasto va solo al contrato
  IF (SELECT IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'graduation_expenses'
        AND COLUMN_NAME = 'activity_id') = 'NO' THEN
    ALTER TABLE graduation_expenses MODIFY activity_id INT UNSIGNED NULL;
  END IF;

END$$

DELIMITER ;

CALL graduation_apply_contracts_schema();
DROP PROCEDURE IF EXISTS graduation_apply_contracts_schema;
