# API Graduación

Rutas montadas en `/api/graduation`.

**Importante:** tras agregar este módulo hay que **volver a desplegar** el backend en Vercel. Si no, el login responderá `Cannot POST /api/graduation/auth/login`.

Prueba rápida tras deploy:
```bash
curl -X POST https://TU-BACKEND/api/graduation/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@liceo1.edu.ec","password":"TU_PASSWORD"}'
```

## Migraciones

Ejecutar en orden en MySQL:

1. `migrations/003_graduation_tables.sql` … `006` (histórico; si la BD ya existe, usar **007**)
2. **`migrations/007_graduation_schema_idempotent.sql`** — recomendado si las tablas **ya están creadas**: `CREATE IF NOT EXISTS` + `ALTER` idempotentes + vistas
3. `migrations/005_graduation_auth_seed_example.sql` (opcional, datos de ejemplo)

### Si las tablas ya existen

Ejecutar solo:

```bash
mysql -h TU_HOST -u TU_USER -p TU_BASE < migrations/007_graduation_schema_idempotent.sql
```

No borra datos. Añade columnas nuevas, renombra `receipt_image` → `transfer_receipt_image` en abonos, y quita `receipt_images` en gastos.

## Dos tablas distintas (no mezclar)

| Tabla | API | Uso |
|-------|-----|-----|
| `graduation_contributions` | `/contributions` | **Abonos** — dinero que deposita cada **curso** (`course_id`, `transfer_receipt_image`) |
| `graduation_expenses` | `/expenses` | **Gastos** — pago a proveedor por **actividad** (`activity_id`, `payment_receipt_image`, `invoice_images`) |

No hay FK entre contributions y expenses. El resumen une totales por vistas (`graduation_course_totals`, `graduation_activity_totals`).

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `GRADUATION_JWT_SECRET` | Secreto para firmar JWT (obligatorio en producción) |
| `GRADUATION_JWT_REQUIRED` | `false` solo para desarrollo sin login (default: requiere JWT) |
| `GRADUATION_SETUP_KEY` | Clave para crear el primer usuario vía API |
| `GRADUATION_API_KEY` | Opcional: header `X-Graduation-Api-Key` |

### Ejemplos para configurar el pipeline

Generar secretos (ejecutar una vez, guardar el resultado en el pipeline — **no** subir a git):

```bash
# JWT (mín. 32 caracteres aleatorios)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Setup key (solo para crear el primer admin por API)
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

#### Backend — archivo `.env` local (desarrollo)

```env
# MySQL (AlwaysData u otro)
DB_HOST=mysql-xxx.alwaysdata.net
DB_USER=jleon2103
DB_PASSWORD=tu_password_mysql
DB_NAME=jleon2103_student_finances
PORT=3004

# Graduación — auth
GRADUATION_JWT_SECRET=a1b2c3d4e5f6789012345678abcdef01234567890abcdef01234567890ab
GRADUATION_JWT_REQUIRED=true
GRADUATION_SETUP_KEY=setup_solo_para_primer_usuario_no_compartir
# GRADUATION_API_KEY=opcional_si_quieres_capa_extra
```

#### Backend — Vercel (Settings → Environment Variables)

Añadir en el proyecto **financial-dashboard-backend**, entorno **Production** (y Preview si aplica):

| Name | Value (ejemplo) | Notas |
|------|-----------------|--------|
| `DB_HOST` | `mysql-jleon2103.alwaysdata.net` | Ya lo tienes |
| `DB_USER` | `jleon2103` | Ya lo tienes |
| `DB_PASSWORD` | `***` | Secret, no visible |
| `DB_NAME` | `jleon2103_student_finances` | Ya lo tienes |
| `GRADUATION_JWT_SECRET` | `a1b2c3...` (64 hex) | **Obligatorio** en prod |
| `GRADUATION_JWT_REQUIRED` | `true` | Login obligatorio |
| `GRADUATION_SETUP_KEY` | `f8e2c1...` (48 hex) | Solo para bootstrap; luego puedes rotar |
| `GRADUATION_API_KEY` | *(vacío o omitir)* | Opcional; si lo usas, el front debe enviar el mismo valor |

`GRADUATION_JWT_REQUIRED`: no definirla = mismo que `true`. Solo pon `false` en un entorno de prueba local sin login.

#### Frontend graduación — Vercel

Proyecto **graduation-dashboard-frontend**:

| Name | Value (ejemplo) |
|------|-----------------|
| `REACT_APP_USE_MOCKS` | `false` |
| `REACT_APP_REQUIRE_AUTH` | `true` |
| `REACT_APP_BACKEND_URL` | `https://financial-dashboard-backend-six.vercel.app/api/graduation` |
| `REACT_APP_COURSES_URL` | `https://financial-dashboard-backend-six.vercel.app/api` |
| `REACT_APP_GRADUATION_API_KEY` | *(solo si definiste `GRADUATION_API_KEY` en el backend)* |

#### GitHub Actions — ejemplo (secrets del repositorio)

En **Settings → Secrets and variables → Actions**:

```yaml
# .github/workflows/deploy-backend.yml (fragmento env)
env:
  GRADUATION_JWT_SECRET: ${{ secrets.GRADUATION_JWT_SECRET }}
  GRADUATION_JWT_REQUIRED: 'true'
  GRADUATION_SETUP_KEY: ${{ secrets.GRADUATION_SETUP_KEY }}
  DB_HOST: ${{ secrets.DB_HOST }}
  DB_USER: ${{ secrets.DB_USER }}
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
  DB_NAME: ${{ secrets.DB_NAME }}
```

Crear secrets en GitHub con los mismos valores que en Vercel (nombres sugeridos: `GRADUATION_JWT_SECRET`, `GRADUATION_SETUP_KEY`, etc.).

#### Si usas `GRADUATION_API_KEY` (opcional, capa extra)

Backend:

```env
GRADUATION_API_KEY=mi-clave-compartida-front-y-back-32chars
```

Frontend (`.env` o Vercel):

```env
REACT_APP_GRADUATION_API_KEY=mi-clave-compartida-front-y-back-32chars
```

Sin esta variable, el API solo exige JWT tras el login (recomendado para empezar).

## Roles

| Rol | Permisos |
|-----|----------|
| `graduation_admin` | Lectura y escritura: abonos, gastos, configuración, usuarios |
| `readonly` | Solo consulta (GET). No puede crear, editar ni eliminar |

## Crear primer administrador

```bash
# 1. Definir en .env del backend:
# GRADUATION_SETUP_KEY=una-clave-secreta-larga
# GRADUATION_JWT_SECRET=otra-clave-secreta-larga

# 2. Crear cuenta admin
curl -X POST https://TU-BACKEND/api/graduation/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Graduation-Setup-Key: una-clave-secreta-larga" \
  -d '{
    "email": "admin@colegio.edu.ec",
    "password": "TuPasswordSeguro",
    "name": "Administrador",
    "campaign_id": 1,
    "role": "graduation_admin"
  }'
```

## Crear usuario solo lectura (después de tener admin)

Desde el dashboard: **Configuración → Usuarios del sistema → Nuevo usuario** (rol: Solo lectura).

O por API (con token de admin):

```bash
curl -X POST https://TU-BACKEND/api/graduation/auth/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -d '{
    "email": "supervision@colegio.edu.ec",
    "password": "PasswordTemporal",
    "name": "Supervisión",
    "role": "readonly",
    "campaign_id": 1
  }'
```

## Endpoints de auth

- `POST /auth/login` — público
- `GET /auth/me` — sesión actual
- `GET /auth/users` — listar (admin)
- `POST /auth/users` — crear (admin)
- `PUT /auth/users/:id` — actualizar (admin)

## Endpoints principales

- `GET /campaigns/active` — campaña activa
- `GET /campaigns/:id/summary` — resumen global
- `GET/POST /contributions` — abonos (POST solo admin)
- `GET/POST /expenses` — gastos (POST solo admin)
