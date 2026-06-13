const express = require('express');
const router = express.Router();
const db = require('../../db');

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function computeFromItems(items, depositAmount) {
  const total = (items || []).reduce(
    (sum, row) => sum + Number(row.quantity || 0) * Number(row.unit_price || 0),
    0
  );
  const deposit = Number(depositAmount) || 0;
  return {
    total_amount: roundMoney(total),
    balance_amount: roundMoney(Math.max(total - deposit, 0)),
  };
}

function formatContractRow(row, items = []) {
  const { total_amount, balance_amount } = computeFromItems(items, row.deposit_amount);
  const formattedItems = items.map((it) => ({
    ...it,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    line_total: roundMoney(Number(it.quantity) * Number(it.unit_price)),
  }));
  return {
    ...row,
    deposit_amount: Number(row.deposit_amount),
    total_amount,
    balance_amount,
    items: formattedItems,
    items_summary: formattedItems.map((i) => i.item_name).join(', '),
  };
}

function fetchItemsForContracts(contractIds, callback) {
  if (!contractIds.length) return callback(null, {});
  const placeholders = contractIds.map(() => '?').join(',');
  db.query(
    `SELECT * FROM graduation_contract_items
     WHERE contract_id IN (${placeholders})
     ORDER BY contract_id, sort_order, id`,
    contractIds,
    (err, rows) => {
      if (err) return callback(err);
      const map = {};
      contractIds.forEach((id) => {
        map[id] = [];
      });
      rows.forEach((row) => {
        if (!map[row.contract_id]) map[row.contract_id] = [];
        map[row.contract_id].push(row);
      });
      callback(null, map);
    }
  );
}

function saveContractItems(contractId, items, callback) {
  db.query('DELETE FROM graduation_contract_items WHERE contract_id = ?', [contractId], (delErr) => {
    if (delErr) return callback(delErr);
    if (!items?.length) return callback(null);

    const values = items.map((it, idx) => [
      contractId,
      it.item_name,
      it.quantity ?? 1,
      it.unit_price ?? 0,
      it.sort_order ?? idx,
    ]);
    const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const flat = values.flat();

    db.query(
      `INSERT INTO graduation_contract_items (contract_id, item_name, quantity, unit_price, sort_order)
       VALUES ${placeholders}`,
      flat,
      callback
    );
  });
}

router.get('/', (req, res) => {
  const { campaign_id } = req.query;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id es requerido' });

  db.query(
    `SELECT gc.*,
      (SELECT COALESCE(SUM(ge.amount), 0) FROM graduation_expenses ge WHERE ge.contract_id = gc.id) AS total_expenses
     FROM graduation_contracts gc
     WHERE gc.campaign_id = ?
     ORDER BY gc.updated_at DESC, gc.id DESC`,
    [campaign_id],
    (err, contracts) => {
      if (err) return res.status(500).json({ error: err.message });
      const ids = contracts.map((c) => c.id);
      fetchItemsForContracts(ids, (itemsErr, itemsMap) => {
        if (itemsErr) return res.status(500).json({ error: itemsErr.message });
        res.json(
          contracts.map((c) => ({
            ...formatContractRow(c, itemsMap[c.id] || []),
            total_expenses: Number(c.total_expenses) || 0,
          }))
        );
      });
    }
  );
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM graduation_contracts WHERE id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'Contrato no encontrado' });
    fetchItemsForContracts([Number(id)], (itemsErr, itemsMap) => {
      if (itemsErr) return res.status(500).json({ error: itemsErr.message });
      res.json(formatContractRow(rows[0], itemsMap[Number(id)] || []));
    });
  });
});

router.post('/', (req, res) => {
  const {
    campaign_id,
    title,
    category,
    vendor_name,
    deposit_amount,
    payment_method,
    payment_reference,
    delivery_date,
    delivery_note,
    status,
    notes,
    items,
  } = req.body;

  if (!campaign_id || !title) {
    return res.status(400).json({ error: 'campaign_id y title son requeridos' });
  }

  db.query(
    `INSERT INTO graduation_contracts
     (campaign_id, title, category, vendor_name, deposit_amount, payment_method, payment_reference,
      delivery_date, delivery_note, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      campaign_id,
      title,
      category || null,
      vendor_name || null,
      deposit_amount ?? 0,
      payment_method || null,
      payment_reference || null,
      delivery_date || null,
      delivery_note || null,
      status || 'abierto',
      notes || null,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const contractId = result.insertId;
      saveContractItems(contractId, items || [], (saveErr) => {
        if (saveErr) return res.status(500).json({ error: saveErr.message });
        db.query('SELECT * FROM graduation_contracts WHERE id = ?', [contractId], (err2, rows) => {
          if (err2) return res.status(500).json({ error: err2.message });
          fetchItemsForContracts([contractId], (itemsErr, itemsMap) => {
            if (itemsErr) return res.status(500).json({ error: itemsErr.message });
            res.status(201).json(formatContractRow(rows[0], itemsMap[contractId] || []));
          });
        });
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    campaign_id,
    title,
    category,
    vendor_name,
    deposit_amount,
    payment_method,
    payment_reference,
    delivery_date,
    delivery_note,
    status,
    notes,
    items,
  } = req.body;

  db.query(
    `UPDATE graduation_contracts
     SET campaign_id = ?, title = ?, category = ?, vendor_name = ?, deposit_amount = ?,
         payment_method = ?, payment_reference = ?, delivery_date = ?, delivery_note = ?,
         status = ?, notes = ?
     WHERE id = ?`,
    [
      campaign_id,
      title,
      category || null,
      vendor_name || null,
      deposit_amount ?? 0,
      payment_method || null,
      payment_reference || null,
      delivery_date || null,
      delivery_note || null,
      status || 'abierto',
      notes || null,
      id,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Contrato no encontrado' });
      saveContractItems(id, items || [], (saveErr) => {
        if (saveErr) return res.status(500).json({ error: saveErr.message });
        res.json({ message: 'Contrato actualizado' });
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM graduation_contracts WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Contrato no encontrado' });
    res.json({ message: 'Contrato eliminado' });
  });
});

module.exports = router;
module.exports.formatContractRow = formatContractRow;
