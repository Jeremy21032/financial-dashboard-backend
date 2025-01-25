const express = require('express');
const router = express.Router();
const db = require('../db');

// 📌 Registrar un nuevo gasto (con múltiples imágenes en image_url)
router.post('/', (req, res) => {
  const { category_id, amount, date, description, observacion, image_url } = req.body;
  
  db.query(
    'INSERT INTO expenses (category_id, amount, date, description, observacion, image_url) VALUES (?, ?, ?, ?, ?, ?)',
    [category_id, amount, date, description, observacion, JSON.stringify(image_url)],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        id: result.insertId, 
        category_id, 
        amount, 
        date, 
        description, 
        observacion, 
        image_url
      });
    }
  );
});

// 📌 Obtener todos los gastos con información de la categoría
router.get('/', (req, res) => {
  db.query(
    `SELECT 
      e.id, 
      e.amount, 
      e.date, 
      e.description, 
      e.observacion, 
      e.image_url, 
      c.name AS category 
    FROM expenses e 
    LEFT JOIN expense_categories c ON e.category_id = c.id
    ORDER BY e.date DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      // Convertir imágenes de JSON a Array
      const formattedResults = results.map(expense => ({
        ...expense,
        image_url: expense.image_url ? JSON.parse(expense.image_url) : []
      }));

      res.json(formattedResults);
    }
  );
});

// 📌 Obtener gastos agrupados por categoría
router.get('/grouped', (req, res) => {
  db.query(
    `SELECT 
      c.name AS category, 
      SUM(e.amount) AS total 
    FROM expenses e 
    LEFT JOIN expense_categories c ON e.category_id = c.id
    GROUP BY c.name`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// 📌 Actualizar un gasto (incluyendo imágenes)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { category_id, amount, date, description, observacion, image_url } = req.body;

  db.query(
    `UPDATE expenses 
     SET category_id = ?, amount = ?, date = ?, description = ?, observacion = ?, image_url = ?
     WHERE id = ?`,
    [category_id, amount, date, description, observacion, JSON.stringify(image_url), id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Gasto no encontrado" });
      }
      res.json({ message: "Gasto actualizado con éxito" });
    }
  );
});

// 📌 Eliminar un gasto
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.query(
    'DELETE FROM expenses WHERE id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Gasto no encontrado" });
      }
      res.json({ message: "Gasto eliminado con éxito" });
    }
  );
});

// 📌 Obtener la vista de gastos divididos por estudiantes
router.get('/expenses-per-student', (req, res) => {
  db.query(
    `SELECT * FROM student_expense_view ORDER BY student_name ASC`,
    (err, results) => {
      if (err) {
        console.error("Error al obtener los gastos por estudiante:", err);
        return res.status(500).json({ message: "Error al obtener los datos", error: err });
      }
      res.json(results);
    }
  );
});

module.exports = router;
