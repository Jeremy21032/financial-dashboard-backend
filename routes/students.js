const express = require('express');
const router = express.Router();
const db = require('../db'); // Archivo de conexión a MySQL

// Obtener todos los estudiantes (filtrados por curso)
router.get('/', (req, res) => {
  const { course_id } = req.query;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query(
    `SELECT DISTINCT s.* 
     FROM students s
     INNER JOIN student_courses sc ON s.id = sc.student_id
     WHERE sc.course_id = ? AND sc.is_active = 1`,
    [course_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// Agregar un estudiante
router.post('/', (req, res) => {
  const { name, email, course_id } = req.body;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  // Primero crear el estudiante
  db.query('INSERT INTO students (name, email) VALUES (?, ?)', [name, email], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const studentId = result.insertId;
    
    // Luego asignarlo al curso
    db.query(
      'INSERT INTO student_courses (student_id, course_id, is_active) VALUES (?, ?, 1)',
      [studentId, course_id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: studentId, name, email, course_id });
      }
    );
  });
});

// Actualizar un estudiante
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, course_id } = req.body;
  
  // Actualizar datos del estudiante
  db.query('UPDATE students SET name = ?, email = ? WHERE id = ?', [name, email, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Si se proporcionó course_id, actualizar la asignación
    if (course_id) {
      db.query(
        `INSERT INTO student_courses (student_id, course_id, is_active) 
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE is_active = 1`,
        [id, course_id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Estudiante actualizado' });
        }
      );
    } else {
      res.json({ message: 'Estudiante actualizado' });
    }
  });
});

// Eliminar un estudiante
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM students WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Estudiante eliminado' });
  });
});

// Asignar un estudiante a un curso
router.post('/:id/courses', (req, res) => {
  const { id } = req.params;
  const { course_id } = req.body;
  
  if (!course_id) {
    return res.status(400).json({ error: 'course_id es requerido' });
  }
  
  db.query(
    `INSERT INTO student_courses (student_id, course_id, is_active) 
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE is_active = 1`,
    [id, course_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Estudiante asignado al curso' });
    }
  );
});

// Desasignar un estudiante de un curso
router.delete('/:id/courses/:course_id', (req, res) => {
  const { id, course_id } = req.params;
  
  db.query(
    'UPDATE student_courses SET is_active = 0 WHERE student_id = ? AND course_id = ?',
    [id, course_id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Estudiante desasignado del curso' });
    }
  );
});

// Obtener cursos de un estudiante
router.get('/:id/courses', (req, res) => {
  const { id } = req.params;
  
  db.query(
    `SELECT 
      c.id,
      c.level,
      c.parallel,
      c.academic_year,
      sc.is_active,
      sc.created_at
    FROM student_courses sc
    JOIN courses c ON sc.course_id = c.id
    WHERE sc.student_id = ? AND sc.is_active = 1
    ORDER BY c.academic_year DESC`,
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

module.exports = router;
