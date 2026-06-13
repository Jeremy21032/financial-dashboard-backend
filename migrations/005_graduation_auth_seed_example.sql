-- Crear campaña + primer administrador (ejecutar TODO el bloque en una sola ejecución en phpMyAdmin)
-- Cambie email y contraseña. Para el hash, en la carpeta del backend ejecute:
--   node -e "console.log(require('bcryptjs').hashSync('SuPasswordAqui', 10))"

-- 1) Campaña activa (si aún no existe id=1)
INSERT INTO graduation_campaigns (id, name, academic_year, expected_total, is_active)
SELECT 1, 'Graduación 3ro Bachillerato 2026', '2025-2026', 0, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM graduation_campaigns WHERE id = 1);

-- 2) Usuario admin (reemplace el hash; ejemplo es password "admin123")
INSERT INTO graduation_users (email, password_hash, name, is_active)
SELECT
  'admin@colegio.edu.ec',
  '$2a$10$8ZuyFnDKF3kPZAjfegLfSuROlCPPLrSr/qOKGCR.vunzfgEu52Pty',
  'Administrador Graduación',
  1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM graduation_users WHERE email = 'admin@colegio.edu.ec');

-- 3) Rol admin (usa el id real del usuario por email, NO @uid suelto)
INSERT INTO graduation_user_roles (user_id, campaign_id, role, course_id)
SELECT u.id, 1, 'graduation_admin', NULL
FROM graduation_users u
WHERE u.email = 'admin@colegio.edu.ec'
  AND NOT EXISTS (
    SELECT 1 FROM graduation_user_roles r
    WHERE r.user_id = u.id AND r.campaign_id = 1 AND r.role = 'graduation_admin'
  );

-- Verificar:
-- SELECT u.id, u.email, r.role, r.campaign_id FROM graduation_users u
-- LEFT JOIN graduation_user_roles r ON r.user_id = u.id;

-- Usuario solo lectura (después del admin; cambie email y hash):
-- INSERT INTO graduation_users (email, password_hash, name, is_active)
-- SELECT 'lectura@colegio.edu.ec', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Consulta solo lectura', 1
-- FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM graduation_users WHERE email = 'lectura@colegio.edu.ec');
--
-- INSERT INTO graduation_user_roles (user_id, campaign_id, role, course_id)
-- SELECT u.id, 1, 'readonly', NULL FROM graduation_users u WHERE u.email = 'lectura@colegio.edu.ec'
-- AND NOT EXISTS (SELECT 1 FROM graduation_user_roles r WHERE r.user_id = u.id AND r.role = 'readonly');
