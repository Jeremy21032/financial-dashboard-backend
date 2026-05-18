const db = require('../../db');

let contributionReceiptColumn = null;
let expenseColumns = null;

/** Columna de imagen en graduation_contributions (migración 007 o esquema antiguo). */
function resolveContributionReceiptColumn(callback) {
  if (contributionReceiptColumn) {
    return callback(null, contributionReceiptColumn);
  }

  db.query(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'graduation_contributions'
       AND COLUMN_NAME IN ('transfer_receipt_image', 'receipt_image')`,
    (err, rows) => {
      if (err) return callback(err);
      const names = rows.map((r) => r.name);
      if (names.includes('transfer_receipt_image')) {
        contributionReceiptColumn = 'transfer_receipt_image';
      } else if (names.includes('receipt_image')) {
        contributionReceiptColumn = 'receipt_image';
      } else {
        contributionReceiptColumn = 'transfer_receipt_image';
      }
      callback(null, contributionReceiptColumn);
    }
  );
}

/** Columnas de documentos en graduation_expenses. */
function resolveExpenseColumns(callback) {
  if (expenseColumns) {
    return callback(null, expenseColumns);
  }

  db.query(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'graduation_expenses'
       AND COLUMN_NAME IN ('payment_receipt_image', 'invoice_images', 'receipt_images')`,
    (err, rows) => {
      if (err) return callback(err);
      const names = rows.map((r) => r.name);
      expenseColumns = {
        payment: names.includes('payment_receipt_image') ? 'payment_receipt_image' : null,
        invoices: names.includes('invoice_images') ? 'invoice_images' : null,
        legacy: names.includes('receipt_images') ? 'receipt_images' : null,
      };
      callback(null, expenseColumns);
    }
  );
}

module.exports = {
  resolveContributionReceiptColumn,
  resolveExpenseColumns,
};
