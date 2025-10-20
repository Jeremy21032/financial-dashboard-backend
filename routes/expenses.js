const express = require('express');
const router = express.Router();
const db = require('../db');

// 📌 Registrar un nuevo gasto (con múltiples imágenes en image_url)
router.post('/', (req, res) => {
  const { category_id, amount, date, description, observacion, image_url, course_id } = req.body;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query(
    'INSERT INTO expenses (category_id, amount, date, description, observacion, image_url, course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [category_id, amount, date, description, observacion, JSON.stringify(image_url), course_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        id: result.insertId, 
        category_id, 
        amount, 
        date, 
        description, 
        observacion, 
        image_url,
        course_id
      });
    }
  );
});

// 📌 Obtener todos los gastos con información de la categoría (filtrados por curso)
router.get('/', (req, res) => {
  const { course_id } = req.query;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
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
    WHERE e.course_id = ?
    ORDER BY e.date DESC`,
    [course_id],
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

// 📌 Obtener gastos agrupados por categoría (filtrados por curso)
router.get('/grouped', (req, res) => {
  const { course_id } = req.query;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query(
    `SELECT 
      c.name AS category, 
      SUM(e.amount) AS total 
    FROM expenses e 
    LEFT JOIN expense_categories c ON e.category_id = c.id
    WHERE e.course_id = ?
    GROUP BY c.name`,
    [course_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// 📌 Actualizar un gasto (incluyendo imágenes)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { category_id, amount, date, description, observacion, image_url, course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }

  db.query(
    `UPDATE expenses 
     SET category_id = ?, amount = ?, date = ?, description = ?, observacion = ?, image_url = ?, course_id = ?
     WHERE id = ?`,
    [category_id, amount, date, description, observacion, JSON.stringify(image_url), course_id, id],
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

// 📌 Obtener la vista de gastos divididos por estudiantes (filtrados por curso)
router.get('/expenses-per-student', (req, res) => {
  const { course_id } = req.query;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query(
    `SELECT * FROM student_expenses_share WHERE course_id = ? ORDER BY student_name ASC`,
    [course_id],
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
