const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/', (req, res) => {
  const { category_id, amount, date, description, observacion, image_url } = req.body;
  
  const imagesJson = JSON.stringify(image_url || []); // Convertir array a JSON

  db.query(
    'INSERT INTO expenses (category_id, amount, date, description, observacion, image_url) VALUES (?, ?, ?, ?, ?, ?)',
    [category_id, amount, date, description, observacion, imagesJson],
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

router.get('/', (req, res) => {
  db.query(
    `SELECT 
      e.id, 
      e.amount, 
      e.date, 
      e.description, 
      e.observacion, 
      e.image_url, 
      c.name AS category_name
    FROM expenses e 
    LEFT JOIN expense_categories c ON e.category_id = c.id
    ORDER BY e.date DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      // Convertir imágenes de JSON a Array antes de enviarlas
      const formattedResults = results.map(expense => ({
        ...expense,
        image_url: expense.image_url ? JSON.parse(expense.image_url) : []
      }));

      res.json(formattedResults);
    }
  );
});

// 📌 Actualizar un gasto (incluyendo imágenes)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { category_id, amount, date, description, observacion, image_url } = req.body;

  const imagesJson = JSON.stringify(image_url || []);

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

module.exports = router;
