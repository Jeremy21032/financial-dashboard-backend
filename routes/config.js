const express = require("express");
const router = express.Router();
const db = require("../db");
const { v4: uuidv4, parse: uuidParse, stringify: uuidStringify } = require("uuid");

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
  
    db.query("UPDATE config SET total_goal = ? WHERE id = 1", [total_goal], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Configuración no encontrada" });
      }
  
      res.json({ message: "Monto total actualizado correctamente", total_goal });
    });
  });
  

module.exports = router;
