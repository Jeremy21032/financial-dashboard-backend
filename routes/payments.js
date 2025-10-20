const express = require("express");
const router = express.Router();
const db = require("../db");
const Payment = require("../models/Payment");
const { default: mongoose } = require("mongoose");

const {
  v4: uuidv4,
  parse: uuidParse,
  stringify: uuidStringify,
} = require("uuid");

function uuidToBuffer(uuid) {
  return Buffer.from(uuidParse(uuid));
}

function bufferToUuid(buffer) {
  return uuidStringify(buffer);
}

// Registrar un pago
router.post("/", (req, res) => {
  const {
    student_id,
    amount,
    date,
    payment_period,
    payment_image,
    payment_status,
    course_id,
  } = req.body;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  const uuid = uuidv4(); // Genera un UUID en formato STRING
  const uuidBuffer = uuidToBuffer(uuid); // Convierte UUID a BINARY(16)

  db.query(
    "INSERT INTO payments (id, student_id, amount, date, payment_period, payment_image, payment_status, course_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      uuidBuffer,
      student_id,
      amount,
      date,
      payment_period,
      payment_image,
      payment_status,
      course_id,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        uuid,
        student_id,
        amount,
        date,
        payment_period,
        payment_image,
        payment_status,
        course_id,
      });
    }
  );
});

// Obtener pagos de todos los estudiantes (filtrados por curso)
router.get("/", (req, res) => {
  const { course_id } = req.query;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query(
    "SELECT id, student_id, amount, date, payment_period, payment_image, payment_status FROM payments WHERE course_id = ? ORDER BY date DESC",
    [course_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      // Convertimos cada `id` de BINARY(16) a UUID STRING
      const payments = results.map((payment) => ({
        ...payment,
        id: bufferToUuid(payment.id), // Convierte de BINARY(16) a UUID STRING
      }));

      res.json(payments);
    }
  );
});

router.put("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const {
      student_id,
      amount,
      date,
      payment_period,
      payment_image,
      payment_status,
      course_id,
    } = req.body;
    
    if (!course_id) {
      return res.status(400).json({ error: 'course_id es requerido' });
    }
    
    const uuidBuffer = uuidToBuffer(uuid);

    db.query(
      "UPDATE payments SET student_id = ?, amount = ?, date = ?, payment_period = ?, payment_image = ?, payment_status = ?, course_id = ? WHERE id = ?",
      [
        student_id,
        amount,
        date,
        payment_period,
        payment_image,
        payment_status,
        course_id,
        uuidBuffer,
      ],
      (err, result) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Error updating payment", error: err });
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Payment not found" });
        }
        res.json({ message: "Payment updated successfully" });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Error updating payment", error });
  }
});

router.delete("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const uuidBuffer = uuidToBuffer(uuid);

    db.query(
      "DELETE FROM payments WHERE id = ?",
      [uuidBuffer],
      (err, result) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Error deleting payment", error: err });
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Payment not found" });
        }
        res.json({ message: "Payment deleted successfully" });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Error deleting payment", error });
  }
});
router.get("/grouped", async (req, res) => {
  try {
    const { course_id } = req.query;
    
    if (!course_id) {
      return res.status(400).json({ error: 'course_id es requerido' });
    }
    
    const query = `
      SELECT 
        s.id AS studentID, 
        s.name AS full_name, 
        p.id AS payment_id,
        p.amount,
        p.date,
        p.payment_period,
        p.payment_status
      FROM students s
      INNER JOIN student_courses sc ON s.id = sc.student_id
      JOIN payments p ON s.id = p.student_id
      WHERE sc.course_id = ? AND sc.is_active = 1 AND p.course_id = ?
      ORDER BY s.id;
    `;

    db.query(query, [course_id, course_id], (err, results) => {
      if (err) {
        console.error("Error al obtener los pagos agrupados:", err);
        return res.status(500).json({ message: "Error al obtener los pagos", error: err });
      }

      // Verificar que los resultados no estén vacíos
      if (!results || results.length === 0) {
        return res.json([]);
      }

      // Agrupar los pagos por estudiante
      const groupedData = results.reduce((acc, row) => {
        const studentID = row.studentID; // Convertir de BINARY(16) a UUID
        const paymentID = bufferToUuid(row.payment_id); // Convertir de BINARY(16) a UUID

        // Si alguno de los UUID es inválido, loguear y omitir
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
            total_goal: 47.56
          };
        }

        acc[studentID].payments.push({
          payment_id: paymentID,
          amount: row.amount,
          date: row.date,
          payment_period: row.payment_period,
          payment_status: row.payment_status
        });

        acc[studentID].total_deposited += parseFloat(row.amount);

        return acc;
      }, {});

      res.json(Object.values(groupedData));
    });
  } catch (error) {
    console.error("Error en el servidor:", error);
    res.status(500).json({ message: "Error interno del servidor", error });
  }
});



module.exports = router;
