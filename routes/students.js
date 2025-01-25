const express = require('express');
const router = express.Router();
const db = require('../db'); // Usando conexión establecida

// 📌 🔹 Obtener todos los estudiantes
router.get('/', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT * FROM students ORDER BY id');
    res.json(results);
  } catch (error) {
    console.error("❌ Error al obtener estudiantes:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Agregar un nuevo estudiante
router.post('/', async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validaciones básicas
    if (!name || !email) {
      return res.status(400).json({ message: "El nombre y el email son obligatorios." });
    }

    const [result] = await db.execute(
      'INSERT INTO students (name, email) VALUES (?, ?)',
      [name, email]
    );

    res.json({ id: result.insertId, name, email });
  } catch (error) {
    console.error("❌ Error al agregar estudiante:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Actualizar un estudiante
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "El nombre y el email son obligatorios." });
    }

    const [result] = await db.execute(
      'UPDATE students SET name = ?, email = ? WHERE id = ?',
      [name, email, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Estudiante no encontrado." });
    }

    res.json({ message: "Estudiante actualizado con éxito." });
  } catch (error) {
    console.error("❌ Error al actualizar estudiante:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Eliminar un estudiante
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute('DELETE FROM students WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Estudiante no encontrado." });
    }

    res.json({ message: "Estudiante eliminado con éxito." });
  } catch (error) {
    console.error("❌ Error al eliminar estudiante:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
