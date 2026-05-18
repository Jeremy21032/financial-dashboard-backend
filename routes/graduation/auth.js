const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../db');
const {
  signGraduationToken,
  requireAdmin,
  verifyTokenFromRequest,
} = require('../../middleware/graduationAuth');

const VALID_ROLES = ['graduation_admin', 'readonly', 'course_delegate'];

function loadUserRoles(userId, cb) {
  db.query(
    `SELECT id, campaign_id, role, course_id FROM graduation_user_roles WHERE user_id = ?`,
    [userId],
    cb
  );
}

function issueSession(user, roles, res) {
  const token = signGraduationToken({
    id: user.id,
    email: user.email,
    name: user.name,
    roles: roles || [],
  });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    roles: roles || [],
  });
}

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email y password son requeridos' });
  }

  db.query(
    'SELECT * FROM graduation_users WHERE email = ? AND is_active = 1',
    [email.trim().toLowerCase()],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!users.length) return res.status(401).json({ error: 'Credenciales inválidas' });

      const user = users[0];
      if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      loadUserRoles(user.id, (errRoles, roles) => {
        if (errRoles) return res.status(500).json({ error: errRoles.message });
        if (!roles.length) {
          return res.status(403).json({ error: 'Usuario sin rol asignado. Contacte al administrador.' });
        }
        issueSession(user, roles, res);
      });
    }
  );
});

router.get('/me', (req, res) => {
  const payload = req.graduationUser || verifyTokenFromRequest(req);
  if (!payload) {
    return res.status(401).json({ error: 'Sesión no válida' });
  }

  db.query(
    'SELECT id, email, name, is_active FROM graduation_users WHERE id = ? AND is_active = 1',
    [payload.id],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!users.length) return res.status(401).json({ error: 'Usuario no encontrado' });

      loadUserRoles(users[0].id, (errRoles, roles) => {
        if (errRoles) return res.status(500).json({ error: errRoles.message });
        res.json({
          user: users[0],
          roles,
        });
      });
    }
  );
});

router.post('/register', (req, res) => {
  const { email, password, name, campaign_id, role, course_id } = req.body;
  const setupKey = process.env.GRADUATION_SETUP_KEY;

  if (!setupKey || req.headers['x-graduation-setup-key'] !== setupKey) {
    return res.status(403).json({ error: 'Registro no autorizado' });
  }

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password y name son requeridos' });
  }

  const roleName = role || 'readonly';
  if (!VALID_ROLES.includes(roleName)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const emailNorm = email.trim().toLowerCase();

  db.query(
    'INSERT INTO graduation_users (email, password_hash, name) VALUES (?, ?, ?)',
    [emailNorm, hash, name],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Email ya registrado' });
        }
        return res.status(500).json({ error: err.message });
      }

      const userId = result.insertId;
      const cid = campaign_id || 1;

      db.query(
        'INSERT INTO graduation_user_roles (user_id, campaign_id, role, course_id) VALUES (?, ?, ?, ?)',
        [userId, cid, roleName, course_id || null],
        (errRole) => {
          if (errRole) return res.status(500).json({ error: errRole.message });
          res.status(201).json({ id: userId, email: emailNorm, name, role: roleName });
        }
      );
    }
  );
});

router.get('/users', requireAdmin, (req, res) => {
  db.query(
    `SELECT u.id, u.email, u.name, u.is_active, u.created_at
     FROM graduation_users u
     ORDER BY u.name ASC`,
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query(
        `SELECT user_id, campaign_id, role, course_id FROM graduation_user_roles`,
        (errRoles, roles) => {
          if (errRoles) return res.status(500).json({ error: errRoles.message });

          const byUser = {};
          roles.forEach((r) => {
            if (!byUser[r.user_id]) byUser[r.user_id] = [];
            byUser[r.user_id].push({
              campaign_id: r.campaign_id,
              role: r.role,
              course_id: r.course_id,
            });
          });

          res.json(
            users.map((u) => ({
              ...u,
              roles: byUser[u.id] || [],
            }))
          );
        }
      );
    }
  );
});

router.post('/users', requireAdmin, (req, res) => {
  const { email, password, name, campaign_id, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'email, password, name y role son requeridos' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const emailNorm = email.trim().toLowerCase();

  db.query(
    'INSERT INTO graduation_users (email, password_hash, name) VALUES (?, ?, ?)',
    [emailNorm, hash, name],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Email ya registrado' });
        }
        return res.status(500).json({ error: err.message });
      }

      const userId = result.insertId;
      db.query(
        'INSERT INTO graduation_user_roles (user_id, campaign_id, role, course_id) VALUES (?, ?, ?, NULL)',
        [userId, campaign_id || 1, role],
        (errRole) => {
          if (errRole) return res.status(500).json({ error: errRole.message });
          res.status(201).json({
            id: userId,
            email: emailNorm,
            name,
            roles: [{ campaign_id: campaign_id || 1, role, course_id: null }],
          });
        }
      );
    }
  );
});

router.put('/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, password, role, campaign_id, is_active } = req.body;

  const updates = [];
  const params = [];

  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  if (password) {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(password, 10));
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }

  const finish = () => {
    if (role && campaign_id) {
      db.query('DELETE FROM graduation_user_roles WHERE user_id = ?', [id], (errDel) => {
        if (errDel) return res.status(500).json({ error: errDel.message });
        db.query(
          'INSERT INTO graduation_user_roles (user_id, campaign_id, role, course_id) VALUES (?, ?, ?, NULL)',
          [id, campaign_id, role],
          (errIns) => {
            if (errIns) return res.status(500).json({ error: errIns.message });
            res.json({ message: 'Usuario actualizado' });
          }
        );
      });
    } else {
      res.json({ message: 'Usuario actualizado' });
    }
  };

  if (updates.length === 0) {
    return finish();
  }

  params.push(id);
  db.query(
    `UPDATE graduation_users SET ${updates.join(', ')} WHERE id = ?`,
    params,
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      finish();
    }
  );
});

module.exports = router;
