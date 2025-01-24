const express = require('express');
const router = express.Router();
const db = require('../db');

// Registrar una salida
router.post('/', (req, res) => {
  const { category, amount, date } = req.body;
  db.query(
    'INSERT INTO expenses (category, amount, date) VALUES (?, ?, ?)',
    [category, amount, date],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, category, amount, date });
    }
  );
});

// Obtener salidas por categoría
router.get('/', (req, res) => {
  db.query('SELECT category, SUM(amount) AS total FROM expenses GROUP BY category', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

module.exports = router;
