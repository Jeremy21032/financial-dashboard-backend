const express = require("express");
const router = express.Router();
const db = require("../db"); // Usar la conexión pool de `db.js`
const { v4: uuidv4, parse: uuidParse, stringify: uuidStringify } = require("uuid");

// 📌 Función para convertir UUID entre formatos
function uuidToBuffer(uuid) {
  return Buffer.from(uuidParse(uuid));
}

function bufferToUuid(buffer) {
  return uuidStringify(buffer);
}

// 📌 🔹 Obtener el total esperado desde la tabla `config`
router.get("/", async (req, res) => {
  try {
    const [results] = await db.execute("SELECT total_goal FROM config LIMIT 1");
    if (results.length > 0) {
      res.json({ total_goal: results[0].total_goal });
    } else {
      res.status(404).json({ message: "Configuración no encontrada" });
    }
  } catch (error) {
    console.error("❌ Error al obtener configuración:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Actualizar el monto total esperado en `config`
router.put("/", async (req, res) => {
  const { total_goal } = req.body;
  try {
    const [result] = await db.execute("UPDATE config SET total_goal = ? WHERE id = 1", [total_goal]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }

    res.json({
      message: "Monto total actualizado correctamente",
      total_goal,
    });
  } catch (error) {
    console.error("❌ Error al actualizar configuración:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Obtener todas las categorías de gastos
router.get("/categories", async (req, res) => {
  try {
    const [results] = await db.execute("SELECT * FROM expense_categories ORDER BY id");
    res.json(results);
  } catch (error) {
    console.error("❌ Error al obtener las categorías:", error);
    res.status(500).json({ message: "Error al obtener las categorías", error: error.message });
  }
});

// 📌 🔹 Agregar una nueva categoría de gasto
router.post("/categories", async (req, res) => {
  const { name, description, observation } = req.body;

  if (!name) {
    return res.status(400).json({ message: "El nombre de la categoría es obligatorio" });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO expense_categories (name, description, observation) VALUES (?, ?, ?)",
      [name, description, observation]
    );

    res.json({ id: result.insertId, name, description, observation });
  } catch (error) {
    console.error("❌ Error al agregar la categoría:", error);
    res.status(500).json({ message: "Error al agregar la categoría", error: error.message });
  }
});

// 📌 🔹 Editar una categoría de gasto
router.put("/categories/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, observation } = req.body;

  try {
    const [result] = await db.execute(
      "UPDATE expense_categories SET name = ?, description = ?, observation = ? WHERE id = ?",
      [name, description, observation, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json({ message: "Categoría actualizada con éxito" });
  } catch (error) {
    console.error("❌ Error al actualizar la categoría:", error);
    res.status(500).json({ message: "Error al actualizar la categoría", error: error.message });
  }
});

// 📌 🔹 Eliminar una categoría de gasto
router.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.execute("DELETE FROM expense_categories WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json({ message: "Categoría eliminada con éxito" });
  } catch (error) {
    console.error("❌ Error al eliminar la categoría:", error);
    res.status(500).json({ message: "Error al eliminar la categoría", error: error.message });
  }
});

module.exports = router;
