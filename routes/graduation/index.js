const express = require('express');
const router = express.Router();
const db = require('../../db');
const authRouter = require('./auth');
const { graduationAuth, blockReadonlyWrites } = require('../../middleware/graduationAuth');
const {
  resolveContributionReceiptColumn,
  resolveExpenseColumns,
} = require('./schema');

router.use(graduationAuth);
router.use(blockReadonlyWrites);

router.use('/auth', authRouter);
router.use('/contracts', require('./contracts'));

function parseJsonImages(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function formatContributionRow(row) {
  const image = row.transfer_receipt_image ?? row.receipt_image ?? null;
  return {
    ...row,
    transfer_receipt_image: image,
  };
}

function formatExpenseRow(row) {
  const legacyImages = parseJsonImages(row.receipt_images);
  const payment = row.payment_receipt_image ?? legacyImages[0] ?? null;
  let invoices = parseJsonImages(row.invoice_images);
  if (!invoices.length && legacyImages.length > 1) {
    invoices = legacyImages.slice(1);
  } else if (!invoices.length && legacyImages.length === 1 && !row.payment_receipt_image) {
    invoices = [];
  }

  return {
    ...row,
    payment_receipt_image: payment,
    invoice_images: invoices,
  };
}

// ——— Campañas ———

router.get('/campaigns', (req, res) => {
  db.query(
    'SELECT * FROM graduation_campaigns ORDER BY is_active DESC, id DESC',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

router.get('/campaigns/active', (req, res) => {
  db.query(
    'SELECT * FROM graduation_campaigns WHERE is_active = 1 ORDER BY id DESC LIMIT 1',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results.length ? results[0] : null);
    }
  );
});

router.get('/campaigns/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM graduation_campaigns WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!results.length) return res.status(404).json({ message: 'Campaña no encontrada' });
    res.json(results[0]);
  });
});

router.post('/campaigns', (req, res) => {
  const { name, academic_year, expected_total, is_active, start_date, end_date } = req.body;
  if (!name || !academic_year) {
    return res.status(400).json({ error: 'name y academic_year son requeridos' });
  }
  db.query(
    `INSERT INTO graduation_campaigns (name, academic_year, expected_total, is_active, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      name,
      academic_year,
      expected_total ?? 0,
      is_active !== undefined ? is_active : 1,
      start_date || null,
      end_date || null,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: result.insertId,
        name,
        academic_year,
        expected_total: expected_total ?? 0,
        is_active: is_active !== undefined ? is_active : 1,
        start_date: start_date || null,
        end_date: end_date || null,
      });
    }
  );
});

router.put('/campaigns/:id', (req, res) => {
  const { id } = req.params;
  const { name, academic_year, expected_total, is_active, start_date, end_date } = req.body;
  db.query(
    `UPDATE graduation_campaigns
     SET name = ?, academic_year = ?, expected_total = ?, is_active = ?, start_date = ?, end_date = ?
     WHERE id = ?`,
    [name, academic_year, expected_total, is_active, start_date || null, end_date || null, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Campaña no encontrada' });
      res.json({ message: 'Campaña actualizada' });
    }
  );
});

router.get('/campaigns/:id/summary', (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM graduation_campaigns WHERE id = ?', [id], (err, campaigns) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!campaigns.length) return res.status(404).json({ message: 'Campaña no encontrada' });

    const campaign = campaigns[0];

    const coursesSql = `
      SELECT
        gcc.id,
        gcc.course_id,
        gcc.expected_contribution,
        gcc.notes,
        c.level,
        c.parallel,
        c.academic_year AS course_year,
        COALESCE(gct.total_contributed, 0) AS total_contributed,
        GREATEST(gcc.expected_contribution - COALESCE(gct.total_contributed, 0), 0) AS remaining,
        CASE
          WHEN gcc.expected_contribution > 0
          THEN LEAST(100, ROUND(COALESCE(gct.total_contributed, 0) / gcc.expected_contribution * 100, 2))
          ELSE 0
        END AS progress_percent
      FROM graduation_campaign_courses gcc
      JOIN courses c ON c.id = gcc.course_id
      LEFT JOIN graduation_course_totals gct
        ON gct.campaign_id = gcc.campaign_id AND gct.course_id = gcc.course_id
      WHERE gcc.campaign_id = ?
      ORDER BY c.level ASC, c.parallel ASC
    `;

    db.query(coursesSql, [id], (errCourses, courseRows) => {
      if (errCourses) return res.status(500).json({ error: errCourses.message });

      const activitiesSql = `
        SELECT
          gat.activity_id AS id,
          gat.name,
          gat.planned_budget,
          gat.sort_order,
          gat.total_spent,
          CASE
            WHEN gat.planned_budget IS NOT NULL AND gat.planned_budget > 0
            THEN GREATEST(gat.planned_budget - gat.total_spent, 0)
            ELSE NULL
          END AS budget_remaining
        FROM graduation_activity_totals gat
        WHERE gat.campaign_id = ?
        ORDER BY gat.sort_order ASC, gat.name ASC
      `;

      db.query(activitiesSql, [id], (errAct, activityRows) => {
        if (errAct) return res.status(500).json({ error: errAct.message });

        db.query(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM graduation_contributions WHERE campaign_id = ?',
          [id],
          (errContrib, contribRows) => {
            if (errContrib) return res.status(500).json({ error: errContrib.message });

            db.query(
              'SELECT COALESCE(SUM(amount), 0) AS total FROM graduation_expenses WHERE campaign_id = ?',
              [id],
              (errExp, expRows) => {
                if (errExp) return res.status(500).json({ error: errExp.message });

                const totalContributed = Number(contribRows[0].total);
                const totalSpent = Number(expRows[0].total);
                const expectedTotal = Number(campaign.expected_total);
                const courseExpectedSum = courseRows.reduce(
                  (s, r) => s + Number(r.expected_contribution || 0),
                  0
                );

                res.json({
                  campaign,
                  totals: {
                    expected_total: expectedTotal,
                    expected_from_courses: courseExpectedSum,
                    total_contributed: totalContributed,
                    total_spent: totalSpent,
                    balance: totalContributed - totalSpent,
                    collection_percent:
                      expectedTotal > 0
                        ? Math.min(100, Math.round((totalContributed / expectedTotal) * 10000) / 100)
                        : 0,
                  },
                  courses: courseRows,
                  activities: activityRows,
                });
              }
            );
          }
        );
      });
    });
  });
});

// ——— Cursos en campaña ———

router.get('/campaigns/:id/courses', (req, res) => {
  const { id } = req.params;
  db.query(
    `SELECT gcc.*, c.level, c.parallel, c.academic_year
     FROM graduation_campaign_courses gcc
     JOIN courses c ON c.id = gcc.course_id
     WHERE gcc.campaign_id = ?
     ORDER BY c.level ASC, c.parallel ASC`,
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

router.put('/campaigns/:id/courses', (req, res) => {
  const { id } = req.params;
  const { courses } = req.body;

  if (!Array.isArray(courses)) {
    return res.status(400).json({ error: 'courses debe ser un arreglo' });
  }

  db.query('DELETE FROM graduation_campaign_courses WHERE campaign_id = ?', [id], (errDel) => {
    if (errDel) return res.status(500).json({ error: errDel.message });

    if (courses.length === 0) {
      return res.json({ message: 'Cursos actualizados', count: 0 });
    }

    const values = courses.map((c) => [
      id,
      c.course_id,
      c.expected_contribution ?? 0,
      c.notes || null,
    ]);
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
    const flat = values.flat();

    db.query(
      `INSERT INTO graduation_campaign_courses (campaign_id, course_id, expected_contribution, notes)
       VALUES ${placeholders}`,
      flat,
      (errIns) => {
        if (errIns) return res.status(500).json({ error: errIns.message });
        res.json({ message: 'Cursos actualizados', count: courses.length });
      }
    );
  });
});

// ——— Actividades ———

router.get('/campaigns/:id/activities', (req, res) => {
  const { id } = req.params;
  db.query(
    `SELECT ga.*, COALESCE(gat.total_spent, 0) AS total_spent
     FROM graduation_activities ga
     LEFT JOIN graduation_activity_totals gat ON gat.activity_id = ga.id
     WHERE ga.campaign_id = ?
     ORDER BY ga.sort_order ASC, ga.name ASC`,
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

router.post('/campaigns/:id/activities', (req, res) => {
  const { id } = req.params;
  const { name, description, planned_budget, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'name es requerido' });

  db.query(
    `INSERT INTO graduation_activities (campaign_id, name, description, planned_budget, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, description || null, planned_budget ?? null, sort_order ?? 0],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: result.insertId,
        campaign_id: Number(id),
        name,
        description: description || null,
        planned_budget: planned_budget ?? null,
        sort_order: sort_order ?? 0,
      });
    }
  );
});

router.put('/activities/:activityId', (req, res) => {
  const { activityId } = req.params;
  const { name, description, planned_budget, sort_order } = req.body;
  db.query(
    `UPDATE graduation_activities
     SET name = ?, description = ?, planned_budget = ?, sort_order = ?
     WHERE id = ?`,
    [name, description || null, planned_budget ?? null, sort_order ?? 0, activityId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Actividad no encontrada' });
      res.json({ message: 'Actividad actualizada' });
    }
  );
});

router.delete('/activities/:activityId', (req, res) => {
  const { activityId } = req.params;
  db.query('DELETE FROM graduation_activities WHERE id = ?', [activityId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Actividad no encontrada' });
    res.json({ message: 'Actividad eliminada' });
  });
});

// ——— Abonos ———

router.get('/contributions', (req, res) => {
  const { campaign_id, course_id } = req.query;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id es requerido' });

  let sql = `
    SELECT gc.*, c.level, c.parallel
    FROM graduation_contributions gc
    JOIN courses c ON c.id = gc.course_id
    WHERE gc.campaign_id = ?
  `;
  const params = [campaign_id];
  if (course_id) {
    sql += ' AND gc.course_id = ?';
    params.push(course_id);
  }
  sql += ' ORDER BY gc.date DESC, gc.id DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results.map(formatContributionRow));
  });
});

router.post('/contributions', (req, res) => {
  const {
    campaign_id,
    course_id,
    amount,
    date,
    transfer_receipt_image,
    receipt_number,
    transfer_motivo,
    reported_by,
    notes,
    status,
  } = req.body;
  if (!campaign_id || !course_id || amount == null || !date) {
    return res.status(400).json({ error: 'campaign_id, course_id, amount y date son requeridos' });
  }

  const imageValue = transfer_receipt_image || null;

  resolveContributionReceiptColumn((colErr, receiptCol) => {
    if (colErr) return res.status(500).json({ error: colErr.message });

    db.query(
      `INSERT INTO graduation_contributions
       (campaign_id, course_id, amount, date, receipt_number, transfer_motivo, reported_by,
        ${receiptCol}, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campaign_id,
        course_id,
        amount,
        date,
        receipt_number || null,
        transfer_motivo || null,
        reported_by || null,
        imageValue,
        notes || null,
        status || 'Registrado',
      ],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const row = {
          id: result.insertId,
          campaign_id,
          course_id,
          amount,
          date,
          receipt_number: receipt_number || null,
          transfer_motivo: transfer_motivo || null,
          reported_by: reported_by || null,
          notes: notes || null,
          status: status || 'Registrado',
        };
        row[receiptCol] = imageValue;
        res.status(201).json(formatContributionRow(row));
      }
    );
  });
});

router.put('/contributions/:id', (req, res) => {
  const { id } = req.params;
  const {
    campaign_id,
    course_id,
    amount,
    date,
    transfer_receipt_image,
    receipt_number,
    transfer_motivo,
    reported_by,
    notes,
    status,
  } = req.body;

  const imageValue = transfer_receipt_image || null;

  resolveContributionReceiptColumn((colErr, receiptCol) => {
    if (colErr) return res.status(500).json({ error: colErr.message });

    db.query(
      `UPDATE graduation_contributions
       SET campaign_id = ?, course_id = ?, amount = ?, date = ?, receipt_number = ?,
           transfer_motivo = ?, reported_by = ?, ${receiptCol} = ?, notes = ?, status = ?
       WHERE id = ?`,
      [
        campaign_id,
        course_id,
        amount,
        date,
        receipt_number || null,
        transfer_motivo || null,
        reported_by || null,
        imageValue,
        notes || null,
        status || 'Registrado',
        id,
      ],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Abono no encontrado' });
        res.json({ message: 'Abono actualizado' });
      }
    );
  });
});

router.delete('/contributions/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM graduation_contributions WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Abono no encontrado' });
    res.json({ message: 'Abono eliminado' });
  });
});

// ——— Gastos ———

router.get('/expenses', (req, res) => {
  const { campaign_id, activity_id, contract_id } = req.query;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id es requerido' });

  let sql = `
    SELECT ge.*, ga.name AS activity_name, gc.title AS contract_title, gc.category AS contract_category
    FROM graduation_expenses ge
    LEFT JOIN graduation_activities ga ON ga.id = ge.activity_id
    LEFT JOIN graduation_contracts gc ON gc.id = ge.contract_id
    WHERE ge.campaign_id = ?
  `;
  const params = [campaign_id];
  if (activity_id) {
    sql += ' AND ge.activity_id = ?';
    params.push(activity_id);
  }
  if (contract_id) {
    sql += ' AND ge.contract_id = ?';
    params.push(contract_id);
  }
  sql += ' ORDER BY ge.date DESC, ge.id DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results.map(formatExpenseRow));
  });
});

router.post('/expenses', (req, res) => {
  const {
    campaign_id,
    activity_id,
    contract_id,
    amount,
    date,
    description,
    payment_receipt_image,
    invoice_images,
  } = req.body;
  if (!campaign_id || amount == null || !date) {
    return res.status(400).json({ error: 'campaign_id, amount y date son requeridos' });
  }
  if (!activity_id && !contract_id) {
    return res.status(400).json({ error: 'Indique contract_id o activity_id' });
  }

  const paymentValue = payment_receipt_image || null;
  const invoicesValue = invoice_images || [];

  resolveExpenseColumns((colErr, cols) => {
    if (colErr) return res.status(500).json({ error: colErr.message });

    const insertCols = ['campaign_id', 'contract_id', 'activity_id', 'amount', 'date', 'description'];
    const insertVals = [
      campaign_id,
      contract_id || null,
      activity_id || null,
      amount,
      date,
      description || null,
    ];

    if (cols.payment) {
      insertCols.push(cols.payment);
      insertVals.push(paymentValue);
    }
    if (cols.invoices) {
      insertCols.push(cols.invoices);
      insertVals.push(JSON.stringify(invoicesValue));
    } else if (cols.legacy) {
      const legacyArr = [];
      if (paymentValue) legacyArr.push(paymentValue);
      legacyArr.push(...invoicesValue);
      insertCols.push(cols.legacy);
      insertVals.push(JSON.stringify(legacyArr));
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    db.query(
      `INSERT INTO graduation_expenses (${insertCols.join(', ')}) VALUES (${placeholders})`,
      insertVals,
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const row = {
          id: result.insertId,
          campaign_id,
          contract_id: contract_id || null,
          activity_id: activity_id || null,
          amount,
          date,
          description: description || null,
          payment_receipt_image: paymentValue,
          invoice_images: JSON.stringify(invoicesValue),
        };
        res.status(201).json(formatExpenseRow(row));
      }
    );
  });
});

router.put('/expenses/:id', (req, res) => {
  const { id } = req.params;
  const {
    campaign_id,
    activity_id,
    contract_id,
    amount,
    date,
    description,
    payment_receipt_image,
    invoice_images,
  } = req.body;

  if (!activity_id && !contract_id) {
    return res.status(400).json({ error: 'Indique contract_id o activity_id' });
  }

  const paymentValue = payment_receipt_image || null;
  const invoicesValue = invoice_images || [];

  resolveExpenseColumns((colErr, cols) => {
    if (colErr) return res.status(500).json({ error: colErr.message });

    const sets = [
      'campaign_id = ?',
      'contract_id = ?',
      'activity_id = ?',
      'amount = ?',
      'date = ?',
      'description = ?',
    ];
    const vals = [
      campaign_id,
      contract_id || null,
      activity_id || null,
      amount,
      date,
      description || null,
    ];

    if (cols.payment) {
      sets.push(`${cols.payment} = ?`);
      vals.push(paymentValue);
    }
    if (cols.invoices) {
      sets.push(`${cols.invoices} = ?`);
      vals.push(JSON.stringify(invoicesValue));
    }
    if (cols.legacy && !cols.payment && !cols.invoices) {
      const legacyArr = [];
      if (paymentValue) legacyArr.push(paymentValue);
      legacyArr.push(...invoicesValue);
      sets.push(`${cols.legacy} = ?`);
      vals.push(JSON.stringify(legacyArr));
    }

    vals.push(id);

    db.query(
      `UPDATE graduation_expenses SET ${sets.join(', ')} WHERE id = ?`,
      vals,
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Gasto no encontrado' });
        res.json({ message: 'Gasto actualizado' });
      }
    );
  });
});

router.delete('/expenses/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM graduation_expenses WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Gasto no encontrado' });
    res.json({ message: 'Gasto eliminado' });
  });
});

module.exports = router;
