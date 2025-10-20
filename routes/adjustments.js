const express = require('express');
const router = express.Router();
const db = require('../db');

// Registrar un ajuste
router.post('/', (req, res) => {
  const { student_id, category, amount, date, course_id } = req.body;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query(
    'INSERT INTO category_adjustments (student_id, category, amount, date, course_id) VALUES (?, ?, ?, ?, ?)',
    [student_id, category, amount, date, course_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, student_id, category, amount, date, course_id });
    }
  );
});

// Obtener ajustes por estudiante y categoría (filtrados por curso)
router.get('/', (req, res) => {
  const { course_id } = req.query;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query(
    'SELECT student_id, category, SUM(amount) AS total FROM category_adjustments WHERE course_id = ? GROUP BY student_id, category',
    [course_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

module.exports = router;
