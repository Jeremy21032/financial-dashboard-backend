const express = require('express');
const router = express.Router();
const db = require('../db');
const { stringify: uuidStringify } = require('uuid');

function normStudentId(v) {
  if (v == null || v === '') return '';
  if (Buffer.isBuffer(v)) {
    if (v.length === 16) {
      try {
        return uuidStringify(v);
      } catch {
        return v.toString('hex');
      }
    }
    return v.toString('utf8');
  }
  return String(v);
}

function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

/** Gasto y presupuesto por estudiante y categoría (misma lógica que el dashboard). */
function fetchCategoryBalances(courseId, cb) {
  const sql = `
    SELECT
      v.studentID AS sid,
      c.id AS category_id,
      SUM(v.shared_amount) AS spent,
      MAX(COALESCE(c.base_amount, 0)) AS budget
    FROM student_expenses_share v
    INNER JOIN expense_categories c
      ON c.course_id = v.course_id AND c.name = v.category
    WHERE v.course_id = ?
    GROUP BY v.studentID, c.id
  `;
  db.query(sql, [courseId], (err, rows) => {
    if (err) return cb(err);
    const map = new Map();
    rows.forEach((r) => {
      const sk = normStudentId(r.sid);
      const cid = Number(r.category_id);
      const spent = round2(r.spent);
      const budget = round2(r.budget);
      if (!map.has(sk)) map.set(sk, new Map());
      map.get(sk).set(cid, { spent, budget });
    });
    cb(null, map);
  });
}

/** Suma saliente por (student, from_cat) y entrante por (student, to_cat) para un curso. */
function fetchAllAllocationSums(courseId, cb) {
  db.query(
    `SELECT student_id, from_category_id, to_category_id, SUM(amount) AS total
     FROM surplus_allocations
     WHERE course_id = ?
     GROUP BY student_id, from_category_id, to_category_id`,
    [courseId],
    (err, rows) => {
      if (err) return cb(err);
      const out = new Map();
      const inn = new Map();
      rows.forEach((r) => {
        const sk = normStudentId(r.student_id);
        const fk = `${sk}::${Number(r.from_category_id)}`;
        const tk = `${sk}::${Number(r.to_category_id)}`;
        out.set(fk, round2((out.get(fk) || 0) + Number(r.total)));
        inn.set(tk, round2((inn.get(tk) || 0) + Number(r.total)));
      });
      cb(null, { out, inn });
    }
  );
}

router.get('/', (req, res) => {
  const { course_id } = req.query;
  if (!course_id) return res.status(400).json({ error: 'course_id es requerido' });

  db.query(
    `SELECT sa.id, sa.course_id, sa.student_id, sa.from_category_id, sa.to_category_id, sa.amount, sa.created_at,
            cf.name AS from_category_name, ct.name AS to_category_name
     FROM surplus_allocations sa
     JOIN expense_categories cf ON cf.id = sa.from_category_id AND cf.course_id = sa.course_id
     JOIN expense_categories ct ON ct.id = sa.to_category_id AND ct.course_id = sa.course_id
     WHERE sa.course_id = ?
     ORDER BY sa.created_at DESC`,
    [course_id],
    (err, rows) => {
      if (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return res.status(503).json({
            error: 'Tabla surplus_allocations no existe. Ejecuta migrations/001_surplus_allocations.sql en MySQL.',
          });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json(
        rows.map((r) => ({
          ...r,
          student_id: normStudentId(r.student_id),
          amount: round2(r.amount),
        }))
      );
    }
  );
});

router.post('/', (req, res) => {
  const { course_id, student_id, from_category_id, to_category_id, amount } = req.body;
  if (!course_id) return res.status(400).json({ error: 'course_id es requerido' });
  if (student_id == null || student_id === '') return res.status(400).json({ error: 'student_id es requerido' });
  const fromId = Number(from_category_id);
  const toId = Number(to_category_id);
  const amt = round2(amount);
  if (!Number.isFinite(fromId) || !Number.isFinite(toId) || fromId === toId) {
    return res.status(400).json({ error: 'Categorías origen y destino inválidas' });
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount debe ser mayor a 0' });
  }

  const studentNorm = normStudentId(student_id);

  db.query(
    `SELECT id FROM expense_categories WHERE course_id = ? AND id IN (?, ?)`,
    [course_id, fromId, toId],
    (err, cats) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!cats || cats.length !== 2) {
        return res.status(400).json({ error: 'Las categorías deben pertenecer al curso' });
      }

      fetchCategoryBalances(course_id, (e2, balanceMap) => {
        if (e2) return res.status(500).json({ error: e2.message });
        const studentCats = balanceMap.get(studentNorm);
        if (!studentCats) {
          return res.status(400).json({ error: 'No hay gastos por categoría para ese estudiante en el curso' });
        }

        fetchAllAllocationSums(course_id, (e3, sums) => {
          if (e3) return res.status(500).json({ error: e3.message });

          const fromCell = studentCats.get(fromId);
          const toCell = studentCats.get(toId);
          if (!fromCell || !toCell) {
            return res.status(400).json({ error: 'Origen o destino sin movimiento en el curso' });
          }

          const surplusRaw = Math.max(0, round2(fromCell.budget - fromCell.spent));
          const deficitRaw = Math.max(0, round2(toCell.spent - toCell.budget));
          if (surplusRaw <= 0) {
            return res.status(400).json({ error: 'La categoría origen no tiene excedente (presupuesto − gasto)' });
          }
          if (deficitRaw <= 0) {
            return res.status(400).json({ error: 'La categoría destino no tiene déficit (gasto − presupuesto)' });
          }

          const fk = `${studentNorm}::${fromId}`;
          const tk = `${studentNorm}::${toId}`;
          const alreadyOut = sums.out.get(fk) || 0;
          const alreadyIn = sums.inn.get(tk) || 0;
          const surplusAvail = round2(surplusRaw - alreadyOut);
          const deficitAvail = round2(deficitRaw - alreadyIn);

          if (surplusAvail <= 0) {
            return res.status(400).json({ error: 'No queda excedente disponible en la categoría origen' });
          }
          if (deficitAvail <= 0) {
            return res.status(400).json({ error: 'El déficit en destino ya está cubierto' });
          }

          const maxAllow = Math.min(surplusAvail, deficitAvail);
          if (amt > maxAllow + 1e-6) {
            return res.status(400).json({
              error: `El monto supera el máximo permitido (${maxAllow.toFixed(2)}): excedente disponible ${surplusAvail.toFixed(2)}, déficit disponible ${deficitAvail.toFixed(2)}`,
            });
          }

          db.query(
            `INSERT INTO surplus_allocations (course_id, student_id, from_category_id, to_category_id, amount)
             VALUES (?, ?, ?, ?, ?)`,
            [course_id, studentNorm, fromId, toId, amt],
            (e4, result) => {
              if (e4) {
                if (e4.code === 'ER_NO_SUCH_TABLE') {
                  return res.status(503).json({
                    error: 'Tabla surplus_allocations no existe. Ejecuta migrations/001_surplus_allocations.sql',
                  });
                }
                return res.status(500).json({ error: e4.message });
              }
              res.json({
                id: result.insertId,
                course_id: Number(course_id),
                student_id: studentNorm,
                from_category_id: fromId,
                to_category_id: toId,
                amount: amt,
              });
            }
          );
        });
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const { course_id } = req.query;
  if (!course_id) return res.status(400).json({ error: 'course_id es requerido en query' });

  db.query(
    `DELETE FROM surplus_allocations WHERE id = ? AND course_id = ?`,
    [id, course_id],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return res.status(503).json({ error: 'Tabla surplus_allocations no existe' });
        }
        return res.status(500).json({ error: err.message });
      }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Registro no encontrado' });
      res.json({ message: 'Asignación eliminada' });
    }
  );
});

module.exports = router;
