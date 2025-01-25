require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const listEndpoints = require('express-list-endpoints');
const cors = require("cors");

const app = express();

// 🔹 Habilitar CORS
app.use(cors());

app.use(cors({
  origin: "*", // 🔹 Cambia esto por la lista de orígenes permitidos en producción
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization"
}));
// 🔹 Aumentar el límite del tamaño de las solicitudes
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// 🔹 Conexión a MySQL con Pool de Conexiones
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 🔹 Probar conexión a la base de datos
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error al conectar a MySQL:", err.message);
    process.exit(1); // Detener la aplicación si la conexión falla
  } else {
    console.log("✅ Conexión a MySQL establecida correctamente.");
    connection.release(); // Liberar conexión
  }
});

// 🔹 Permitir Promesas con `db.execute()`
const promisePool = db.promise();

// 🔹 Middleware para hacer accesible `db` en todas las rutas
app.use((req, res, next) => {
  req.db = promisePool;
  next();
});

// 🔹 Definir rutas
app.use('/api/students', require('./routes/students'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/config', require('./routes/config'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/adjustments', require('./routes/adjustments'));

// 🔹 Puerto del servidor
const PORT = process.env.PORT || 3004;
const DEPLOYED_URL = process.env.DEPLOYED_URL || `http://localhost:${PORT}`;

// 🔹 Ruta para verificar si el servidor está corriendo
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Backend is running successfully!",
    timestamp: new Date().toISOString(),
  });
});

// 🔹 Iniciar Servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en: ${DEPLOYED_URL}`);

  // 🔹 Listar todas las rutas expuestas
  const endpoints = listEndpoints(app);
  console.log('📌 Rutas disponibles:');
  endpoints.forEach((endpoint) => {
    console.log(`- ${endpoint.methods.join(', ')} ${endpoint.path}`);
  });
});

module.exports = promisePool;
