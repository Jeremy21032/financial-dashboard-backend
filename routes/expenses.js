const express = require("express");
const router = express.Router();
const db = require("../db"); // Conexión MySQL usando `db.js`

// 📌 🔹 Registrar un nuevo gasto (soporte para múltiples imágenes)
router.post("/", async (req, res) => {
  try {
    const { category_id, amount, date, description, observacion, image_url } = req.body;
    const imagesJson = JSON.stringify(image_url || []); // Convertir imágenes a JSON

    const [result] = await db.execute(
      `INSERT INTO expenses (category_id, amount, date, description, observacion, image_url) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [category_id, amount, date, description, observacion, imagesJson]
    );

    res.json({
      id: result.insertId,
      category_id,
      amount,
      date,
      description,
      observacion,
      image_url,
    });
  } catch (error) {
    console.error("❌ Error al registrar gasto:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Obtener todos los gastos con imágenes correctamente formateadas
router.get("/", async (req, res) => {
  try {
    const [results] = await db.execute(`
      SELECT 
        e.id, 
        e.amount, 
        e.date, 
        e.description, 
        e.observacion, 
        e.image_url, 
        c.name AS category_name
      FROM expenses e 
      LEFT JOIN expense_categories c ON e.category_id = c.id
      ORDER BY e.date DESC
    `);

    // Convertir imágenes de JSON a Array antes de enviarlas
    const formattedResults = results.map(expense => ({
      ...expense,
      image_url: expense.image_url ? JSON.parse(expense.image_url) : [],
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error("❌ Error al obtener gastos:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Obtener la vista `student_expenses_share` (Gastos por Estudiante)
router.get("/expenses-per-student", async (req, res) => {
  try {
    const [results] = await db.execute(`
      SELECT * FROM student_expenses_share
      ORDER BY student_name ASC
    `);

    res.json(results);
  } catch (error) {
    console.error("❌ Error al obtener gastos por estudiante:", error);
    res.status(500).json({ message: "Error al obtener los datos", error: error.message });
  }
});

// 📌 🔹 Actualizar un gasto (incluyendo imágenes)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, amount, date, description, observacion, image_url } = req.body;
    const imagesJson = JSON.stringify(image_url || []);

    const [result] = await db.execute(
      `UPDATE expenses 
       SET category_id = ?, amount = ?, date = ?, description = ?, observacion = ?, image_url = ?
       WHERE id = ?`,
      [category_id, amount, date, description, observacion, imagesJson, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    res.json({ message: "Gasto actualizado con éxito" });
  } catch (error) {
    console.error("❌ Error al actualizar gasto:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Eliminar un gasto
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute("DELETE FROM expenses WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    res.json({ message: "Gasto eliminado con éxito" });
  } catch (error) {
    console.error("❌ Error al eliminar gasto:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
