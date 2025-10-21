# 💼 Financial Dashboard Backend 

API REST para el sistema de gestión financiera de estudiantes y cursos.

## 🚀 Características

- ✅ **Gestión de Cursos** - Crear y administrar cursos por paralelo
- ✅ **Gestión de Estudiantes** - Registro y administración por curso
- ✅ **Gestión de Pagos** - Registro de pagos con comprobantes
- ✅ **Gestión de Gastos** - Control de gastos por categorías
- ✅ **Gestión de Categorías** - Categorías personalizadas por curso
- ✅ **Autenticación** - Sistema de login con roles
- ✅ **CORS habilitado** - Para integración con frontend
- ✅ **Base de datos MySQL** - Almacenamiento persistente

## 🛠️ Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **MySQL** - Base de datos
- **Vercel** - Plataforma de despliegue

## 📋 Endpoints API

### 🔐 Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión

### 📚 Cursos
- `GET /api/courses` - Listar todos los cursos
- `GET /api/courses/active` - Listar cursos activos
- `POST /api/courses` - Crear nuevo curso
- `PUT /api/courses/:id` - Actualizar curso
- `DELETE /api/courses/:id` - Eliminar curso

### 👥 Estudiantes
- `GET /api/students?course_id=X` - Listar estudiantes por curso
- `POST /api/students` - Crear nuevo estudiante
- `PUT /api/students/:id` - Actualizar estudiante
- `DELETE /api/students/:id` - Eliminar estudiante

### 💰 Pagos
- `GET /api/payments?course_id=X` - Listar pagos por curso
- `POST /api/payments` - Crear nuevo pago
- `PUT /api/payments/:id` - Actualizar pago
- `DELETE /api/payments/:id` - Eliminar pago

### 💸 Gastos
- `GET /api/expenses?course_id=X` - Listar gastos por curso
- `POST /api/expenses` - Crear nuevo gasto
- `PUT /api/expenses/:id` - Actualizar gasto
- `DELETE /api/expenses/:id` - Eliminar gasto

### ⚙️ Configuraciones
- `GET /api/config/categories?course_id=X` - Listar categorías por curso
- `POST /api/config/categories` - Crear nueva categoría
- `PUT /api/config/categories/:id` - Actualizar categoría
- `DELETE /api/config/categories/:id` - Eliminar categoría

## 🔧 Instalación Local

1. **Clonar el repositorio**:
   ```bash
   git clone [url-del-repo]
   cd financial-dashboard-backend
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   ```bash
   cp .env-sample .env
   # Editar .env con tus credenciales de base de datos
   ```

4. **Ejecutar el servidor**:
   ```bash
   npm start
   ```

## 🌐 Despliegue en Vercel

El backend está configurado para desplegarse automáticamente en Vercel:

- **URL de producción**: `https://financial-dashboard-backend.vercel.app`
- **Configuración**: `vercel.json` incluido
- **Variables de entorno**: Configuradas en Vercel Dashboard

## 📊 Estructura de Base de Datos

### Tablas principales:
- `courses` - Cursos y paralelos
- `students` - Estudiantes por curso
- `payments` - Pagos de estudiantes
- `expenses` - Gastos por curso
- `expense_categories` - Categorías de gastos por curso

### Relaciones:
- Estudiantes → Cursos (course_id)
- Pagos → Estudiantes + Cursos
- Gastos → Cursos
- Categorías → Cursos

## 🔒 Seguridad

- ✅ **CORS configurado** para dominios específicos
- ✅ **Validación de entrada** en todos los endpoints
- ✅ **Manejo de errores** centralizado
- ✅ **Límites de request** configurados

## 📝 Variables de Entorno

```env
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=tu_base_datos
PORT=3004
```

## 🚀 Scripts Disponibles

- `npm start` - Iniciar servidor en producción
- `npm run dev` - Iniciar servidor en desarrollo (si está configurado)

## 📞 Soporte

Para soporte técnico o reportar bugs, contacta al equipo de desarrollo.

---

**Desarrollado con ❤️ para la gestión financiera educativa**
