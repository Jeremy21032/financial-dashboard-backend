const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener todos los cursos
router.get('/', (req, res) => {
  db.query('SELECT * FROM courses ORDER BY is_active DESC, level ASC, parallel ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Obtener solo cursos activos
router.get('/active', (req, res) => {
  db.query('SELECT * FROM courses WHERE is_active = 1 ORDER BY level ASC, parallel ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Obtener un curso por ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM courses WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(404).json({ message: 'Curso no encontrado' });
    }
    res.json(results[0]);
  });
});

// Crear un nuevo curso
router.post('/', (req, res) => {
  const { level, parallel, academic_year, is_active } = req.body;
  
  if (!level || !parallel || !academic_year) {
    return res.status(400).json({ error: 'level, parallel y academic_year son requeridos' });
  }
  
  db.query(
    'INSERT INTO courses (level, parallel, academic_year, is_active) VALUES (?, ?, ?, ?)',
    [level, parallel, academic_year, is_active || 1],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        id: result.insertId, 
        level, 
        parallel, 
        academic_year, 
        is_active: is_active || 1 
      });
    }
  );
});

// Actualizar un curso
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { level, parallel, academic_year, is_active } = req.body;
  
  db.query(
    'UPDATE courses SET level = ?, parallel = ?, academic_year = ?, is_active = ? WHERE id = ?',
    [level, parallel, academic_year, is_active, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      res.json({ message: 'Curso actualizado' });
    }
  );
});

// Eliminar un curso (soft delete - desactivar)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.query(
    'UPDATE courses SET is_active = 0 WHERE id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      res.json({ message: 'Curso desactivado' });
    }
  );
});

// Obtener resumen de un curso
router.get('/:id/summary', (req, res) => {
  const { id } = req.params;
  
  db.query(
    'SELECT * FROM course_summary WHERE course_id = ?',
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      res.json(results[0]);
    }
  );
});

module.exports = router;

