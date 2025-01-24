const express = require('express');
const router = express.Router();
const db = require('../db');

// Registrar un ajuste
router.post('/', (req, res) => {
  const { student_id, category, amount, date } = req.body;
  db.query(
    'INSERT INTO category_adjustments (student_id, category, amount, date) VALUES (?, ?, ?, ?)',
    [student_id, category, amount, date],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, student_id, category, amount, date });
    }
  );
});

// Obtener ajustes por estudiante y categoría
router.get('/', (req, res) => {
  db.query(
    'SELECT student_id, category, SUM(amount) AS total FROM category_adjustments GROUP BY student_id, category',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

module.exports = router;
