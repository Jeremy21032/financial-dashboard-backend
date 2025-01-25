const express = require("express");
const router = express.Router();
const db = require("../db");
const {
  v4: uuidv4,
  parse: uuidParse,
  stringify: uuidStringify,
} = require("uuid");

// Función para convertir UUID entre formatos
function uuidToBuffer(uuid) {
  return Buffer.from(uuidParse(uuid));
}

function bufferToUuid(buffer) {
  return uuidStringify(buffer);
}

// Obtener el total esperado desde la tabla config
router.get("/", (req, res) => {
  db.query("SELECT total_goal FROM config LIMIT 1", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length > 0) {
      res.json({ total_goal: results[0].total_goal });
    } else {
      res.status(404).json({ message: "Configuración no encontrada" });
    }
  });
});

router.put("/", (req, res) => {
  const { total_goal } = req.body;

  db.query(
    "UPDATE config SET total_goal = ? WHERE id = 1",
    [total_goal],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Configuración no encontrada" });
      }

      res.json({
        message: "Monto total actualizado correctamente",
        total_goal,
      });
    }
  );
});

// 🔹 Obtener todas las categorías de gastos
router.get("/categories", (req, res) => {
  db.query("SELECT * FROM expense_categories ORDER BY id", (err, results) => {
    if (err) {
      console.error("Error al obtener las categorías:", err);
      return res
        .status(500)
        .json({ message: "Error al obtener las categorías", error: err });
    }
    res.json(results);
  });
});

// 🔹 Agregar una nueva categoría de gasto
router.post("/categories", (req, res) => {
  const { name, description, observation } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ message: "El nombre de la categoría es obligatorio" });
  }

  db.query(
    "INSERT INTO expense_categories (name, description, observation) VALUES (?, ?, ?)",
    [name, description, observation],
    (err, result) => {
      if (err) {
        console.error("Error al agregar la categoría:", err);
        return res
          .status(500)
          .json({ message: "Error al agregar la categoría", error: err });
      }
      res.json({ id: result.insertId, name, description, observation });
    }
  );
});

// 🔹 Editar una categoría de gasto
router.put("/categories/:id", (req, res) => {
  const { id } = req.params;
  const { name, description, observation } = req.body;

  db.query(
    "UPDATE expense_categories SET name = ?, description = ?, observation = ? WHERE id = ?",
    [name, description, observation, id],
    (err, result) => {
      if (err) {
        console.error("Error al actualizar la categoría:", err);
        return res
          .status(500)
          .json({ message: "Error al actualizar la categoría", error: err });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Categoría no encontrada" });
      }
      res.json({ message: "Categoría actualizada con éxito" });
    }
  );
});

// 🔹 Eliminar una categoría de gasto
router.delete("/categories/:id", (req, res) => {
  const { id } = req.params;

  db.query(
    "DELETE FROM expense_categories WHERE id = ?",
    [id],
    (err, result) => {
      if (err) {
        console.error("Error al eliminar la categoría:", err);
        return res
          .status(500)
          .json({ message: "Error al eliminar la categoría", error: err });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Categoría no encontrada" });
      }
      res.json({ message: "Categoría eliminada con éxito" });
    }
  );
});

module.exports = router;
