const express = require('express');
const router = express.Router();
const db = require('../db'); // Archivo de conexión a MySQL

// Obtener todos los estudiantes
router.get('/', (req, res) => {
  db.query('SELECT * FROM students', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Agregar un estudiante
router.post('/', (req, res) => {
  const { name, email } = req.body;
  db.query('INSERT INTO students (name, email) VALUES (?, ?)', [name, email], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: result.insertId, name, email });
  });
});

// Actualizar un estudiante
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  db.query('UPDATE students SET name = ?, email = ? WHERE id = ?', [name, email, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Estudiante actualizado' });
  });
});

// Eliminar un estudiante
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM students WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Estudiante eliminado' });
  });
});

module.exports = router;
