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

/** Por estudiante y categoría: spent, budget (misma lógica que el dashboard). */
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

/** Totales de excedente y déficit por categoría (sumando todos los estudiantes). */
function aggregateCourseCategoryTotals(balanceMap) {
  const surplusTotalByCat = new Map();
  const deficitTotalByCat = new Map();
  balanceMap.forEach((catMap) => {
    catMap.forEach((cell, cid) => {
      if (!(cell.budget > 0)) return;
      const raw = round2(cell.spent - cell.budget);
      if (raw < -0.005) {
        surplusTotalByCat.set(cid, round2((surplusTotalByCat.get(cid) || 0) - raw));
      } else if (raw > 0.005) {
        deficitTotalByCat.set(cid, round2((deficitTotalByCat.get(cid) || 0) + raw));
      }
    });
  });
  return { surplusTotalByCat, deficitTotalByCat };
}

function fetchCourseAllocationSums(courseId, cb) {
  db.query(
    `SELECT from_category_id, to_category_id, SUM(amount) AS total
     FROM surplus_allocations
     WHERE course_id = ?
     GROUP BY from_category_id, to_category_id`,
    [courseId],
    (err, rows) => {
      if (err) return cb(err);
      const out = new Map();
      const inn = new Map();
      rows.forEach((r) => {
        const fid = Number(r.from_category_id);
        const tid = Number(r.to_category_id);
        out.set(fid, round2((out.get(fid) || 0) + Number(r.total)));
        inn.set(tid, round2((inn.get(tid) || 0) + Number(r.total)));
      });
      cb(null, { out, inn });
    }
  );
}

router.get('/', (req, res) => {
  const { course_id } = req.query;
  if (!course_id) return res.status(400).json({ error: 'course_id es requerido' });

  db.query(
    `SELECT sa.id, sa.course_id, sa.from_category_id, sa.to_category_id, sa.amount, sa.created_at,
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
          amount: round2(r.amount),
        }))
      );
    }
  );
});

router.post('/', (req, res) => {
  const { course_id, from_category_id, to_category_id, amount } = req.body;
  if (!course_id) return res.status(400).json({ error: 'course_id es requerido' });
  const fromId = Number(from_category_id);
  const toId = Number(to_category_id);
  const amt = round2(amount);
  if (!Number.isFinite(fromId) || !Number.isFinite(toId) || fromId === toId) {
    return res.status(400).json({ error: 'Categorías origen y destino inválidas' });
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount debe ser mayor a 0' });
  }

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
        const totals = aggregateCourseCategoryTotals(balanceMap);

        fetchCourseAllocationSums(course_id, (e3, sums) => {
          if (e3) return res.status(500).json({ error: e3.message });

          const surplusRaw = totals.surplusTotalByCat.get(fromId) || 0;
          const deficitRaw = totals.deficitTotalByCat.get(toId) || 0;
          if (surplusRaw <= 0) {
            return res.status(400).json({ error: 'En el curso no hay excedente agregado en la categoría origen' });
          }
          if (deficitRaw <= 0) {
            return res.status(400).json({ error: 'En el curso no hay déficit agregado en la categoría destino' });
          }

          const alreadyOut = sums.out.get(fromId) || 0;
          const alreadyIn = sums.inn.get(toId) || 0;
          const surplusAvail = round2(surplusRaw - alreadyOut);
          const deficitAvail = round2(deficitRaw - alreadyIn);

          if (surplusAvail <= 0) {
            return res.status(400).json({ error: 'No queda excedente de curso disponible en esa categoría origen' });
          }
          if (deficitAvail <= 0) {
            return res.status(400).json({ error: 'El déficit de curso en destino ya está cubierto' });
          }

          const maxAllow = Math.min(surplusAvail, deficitAvail);
          if (amt > maxAllow + 1e-6) {
            return res.status(400).json({
              error: `El monto supera el máximo (${maxAllow.toFixed(2)}): excedente curso disponible ${surplusAvail.toFixed(2)}, déficit curso disponible ${deficitAvail.toFixed(2)}`,
            });
          }

          db.query(
            `INSERT INTO surplus_allocations (course_id, from_category_id, to_category_id, amount)
             VALUES (?, ?, ?, ?)`,
            [course_id, fromId, toId, amt],
            (e4, result) => {
              if (e4) {
                if (e4.code === 'ER_NO_SUCH_TABLE') {
                  return res.status(503).json({
                    error: 'Tabla surplus_allocations no existe. Ejecuta migrations/001_surplus_allocations.sql',
                  });
                }
                if (e4.code === 'ER_BAD_FIELD_ERROR' || e4.message.includes('student_id')) {
                  return res.status(503).json({
                    error:
                      'La tabla aún tiene columna student_id. Ejecuta migrations/002_surplus_allocations_course_level_alter.sql',
                  });
                }
                return res.status(500).json({ error: e4.message });
              }
              res.json({
                id: result.insertId,
                course_id: Number(course_id),
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
