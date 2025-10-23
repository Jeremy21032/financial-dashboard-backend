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

// Obtener el total esperado desde la tabla config por curso
router.get("/", (req, res) => {
  const { course_id } = req.query;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query("SELECT total_goal FROM config WHERE course_id = ?", [course_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length > 0) {
      res.json({ total_goal: results[0].total_goal });
    } else {
      res.status(404).json({ message: "Configuración no encontrada para este curso" });
    }
  });
});

router.put("/", (req, res) => {
  const { total_goal, course_id } = req.body;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }

  // Usar INSERT ... ON DUPLICATE KEY UPDATE para crear o actualizar
  db.query(
    "INSERT INTO config (course_id, total_goal) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_goal = ?",
    [course_id, total_goal, total_goal],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        message: "Monto total actualizado correctamente",
        total_goal,
        course_id
      });
    }
  );
});

// 🔹 Obtener todas las categorías de gastos por curso
router.get("/categories", (req, res) => {
  const { course_id } = req.query;
  
  console.log("🔍 [Backend] course_id recibido:", course_id);
  console.log("🔍 [Backend] Tipo de course_id:", typeof course_id);
  
  let query = "SELECT * FROM expense_categories";
  let params = [];
  
  if (course_id && course_id !== 'undefined' && course_id !== 'null') {
    query += " WHERE course_id = ?";
    params.push(parseInt(course_id));
  } else {
    console.log("⚠️ [Backend] No hay course_id válido, no se mostrarán categorías");
    return res.json([]);
  }
  
  query += " ORDER BY id";
  
  console.log("🔍 [Backend] Query final:", query);
  console.log("🔍 [Backend] Params:", params);
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error("❌ [Backend] Error al obtener las categorías:", err);
      return res
        .status(500)
        .json({ message: "Error al obtener las categorías", error: err });
    }
    console.log("✅ [Backend] Categorías encontradas:", results.length);
    console.log("🔍 [Backend] Categorías:", results.map(c => ({ id: c.id, name: c.name, course_id: c.course_id })));
    res.json(results);
  });
});

// 🔹 Agregar una nueva categoría de gasto por curso
router.post("/categories", (req, res) => {
  const { name, description, observation, base_amount, course_id } = req.body;

  console.log("🔍 [Backend] POST categories - course_id:", course_id);
  console.log("🔍 [Backend] POST categories - base_amount:", base_amount);

  if (!name) {
    return res
      .status(400)
      .json({ message: "El nombre de la categoría es obligatorio" });
  }

  if (!course_id) {
    return res
      .status(400)
      .json({ message: "El ID del curso es obligatorio" });
  }

  // Si base_amount es null, undefined o vacío, usar 0
  const safeBaseAmount = base_amount || 0;

  db.query(
    "INSERT INTO expense_categories (name, description, observation, base_amount, course_id) VALUES (?, ?, ?, ?, ?)",
    [name, description, observation, safeBaseAmount, course_id],
    (err, result) => {
      if (err) {
        console.error("❌ [Backend] Error al agregar la categoría:", err);
        return res
          .status(500)
          .json({ message: "Error al agregar la categoría", error: err });
      }
      console.log("✅ [Backend] Categoría creada con ID:", result.insertId);
      res.json({ id: result.insertId, name, description, observation, base_amount: safeBaseAmount, course_id });
    }
  );
});

// 🔹 Editar una categoría de gasto
router.put("/categories/:id", (req, res) => {
  const { id } = req.params;
  const { name, description, observation, base_amount, course_id } = req.body;

  console.log("🔍 [Backend] PUT categories - course_id:", course_id);
  console.log("🔍 [Backend] PUT categories - base_amount:", base_amount);

  if (!course_id) {
    return res
      .status(400)
      .json({ message: "El ID del curso es obligatorio" });
  }

  // Si base_amount es null, undefined o vacío, usar 0
  const safeBaseAmount = base_amount || 0;

  db.query(
    "UPDATE expense_categories SET name = ?, description = ?, observation = ?, base_amount = ?, course_id = ? WHERE id = ?",
    [name, description, observation, safeBaseAmount, course_id, id],
    (err, result) => {
      if (err) {
        console.error("❌ [Backend] Error al actualizar la categoría:", err);
        return res
          .status(500)
          .json({ message: "Error al actualizar la categoría", error: err });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Categoría no encontrada" });
      }
      console.log("✅ [Backend] Categoría actualizada correctamente");
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

// 🔹 Endpoint para debug - ver todas las categorías y sus cursos
router.get("/categories-debug", (req, res) => {
  db.query(`
    SELECT 
      ec.id,
      ec.name,
      ec.course_id,
      c.level,
      c.parallel,
      c.academic_year
    FROM expense_categories ec
    LEFT JOIN courses c ON ec.course_id = c.id
    ORDER BY ec.id
  `, (err, results) => {
    if (err) {
      console.error("Error al obtener debug de categorías:", err);
      return res.status(500).json({ message: "Error al obtener debug", error: err });
    }
    res.json(results);
  });
});

module.exports = router;
