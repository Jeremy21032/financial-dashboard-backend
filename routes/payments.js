const express = require("express");
const router = express.Router();
const db = require("../db"); // Usando conexión establecida

const { v4: uuidv4, parse: uuidParse, stringify: uuidStringify } = require("uuid");

// Funciones para convertir UUID entre formatos
function uuidToBuffer(uuid) {
  return Buffer.from(uuidParse(uuid));
}

function bufferToUuid(buffer) {
  return uuidStringify(buffer);
}

// 📌 🔹 Registrar un nuevo pago
router.post("/", async (req, res) => {
  try {
    const { student_id, amount, date, payment_period, payment_image, payment_status } = req.body;
    const uuid = uuidv4(); // Generar UUID en formato string
    const uuidBuffer = uuidToBuffer(uuid); // Convertir UUID a formato BINARY(16)

    await db.execute(
      `INSERT INTO payments (id, student_id, amount, date, payment_period, payment_image, payment_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidBuffer, student_id, amount, date, payment_period, payment_image, payment_status]
    );

    res.json({ id: uuid, student_id, amount, date, payment_period, payment_image, payment_status });
  } catch (error) {
    console.error("❌ Error al registrar pago:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Obtener todos los pagos de estudiantes
router.get("/", async (req, res) => {
  try {
    const [results] = await db.execute(`
      SELECT id, student_id, amount, date, payment_period, payment_image, payment_status 
      FROM payments ORDER BY date DESC
    `);

    // Convertir ID de BINARY(16) a UUID STRING
    const payments = results.map(payment => ({
      ...payment,
      id: bufferToUuid(payment.id),
    }));

    res.json(payments);
  } catch (error) {
    console.error("❌ Error al obtener pagos:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Actualizar un pago
router.put("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const { student_id, amount, date, payment_period, payment_image, payment_status } = req.body;
    const uuidBuffer = uuidToBuffer(uuid);

    const [result] = await db.execute(
      `UPDATE payments SET student_id = ?, amount = ?, date = ?, 
       payment_period = ?, payment_image = ?, payment_status = ? WHERE id = ?`,
      [student_id, amount, date, payment_period, payment_image, payment_status, uuidBuffer]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({ message: "Payment updated successfully" });
  } catch (error) {
    console.error("❌ Error al actualizar pago:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Eliminar un pago
router.delete("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const uuidBuffer = uuidToBuffer(uuid);

    const [result] = await db.execute("DELETE FROM payments WHERE id = ?", [uuidBuffer]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("❌ Error al eliminar pago:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 🔹 Obtener pagos agrupados por estudiante
router.get("/grouped", async (req, res) => {
  try {
    const [results] = await db.execute(`
      SELECT 
        s.id AS studentID, 
        s.name AS full_name, 
        p.id AS payment_id,
        p.amount,
        p.date,
        p.payment_period,
        p.payment_status
      FROM students s
      JOIN payments p ON s.id = p.student_id
      ORDER BY s.id;
    `);

    if (!results || results.length === 0) {
      return res.json([]);
    }

    // Agrupar los pagos por estudiante
    const groupedData = results.reduce((acc, row) => {
      const studentID = row.studentID;
      const paymentID = bufferToUuid(row.payment_id); // Convertir UUID de BINARY(16) a string

      if (!studentID || !paymentID) {
        console.warn("UUID inválido detectado, omitiendo fila:", row);
        return acc;
      }

      if (!acc[studentID]) {
        acc[studentID] = {
          studentID,
          full_name: row.full_name,
          payments: [],
          total_deposited: 0,
          total_goal: 47.56, // Meta de depósito
        };
      }

      acc[studentID].payments.push({
        payment_id: paymentID,
        amount: row.amount,
        date: row.date,
        payment_period: row.payment_period,
        payment_status: row.payment_status,
      });

      acc[studentID].total_deposited += parseFloat(row.amount);

      return acc;
    }, {});

    res.json(Object.values(groupedData));
  } catch (error) {
    console.error("❌ Error al obtener pagos agrupados:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
