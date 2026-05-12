require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const listEndpoints = require('express-list-endpoints'); // Para listar endpoints
const cors = require("cors");

const app = express();

// Habilitar CORS
app.use(cors());

// 🔹 Aumentar el límite del tamaño de las solicitudes
app.use(express.json({ limit: '500mb' })); // Para JSON
app.use(express.urlencoded({ limit: '500mb', extended: true })); // Para datos de formularios

// Si usas body-parser explícitamente
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

// 🔹 Función para conectar y mantener MySQL activo
let db;
let pingIntervalId = null;
let reconnectTimer = null;

const RETRYABLE_DB_ERRORS = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

const scheduleReconnect = () => {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToDatabase();
  }, 5000);
};

const connectToDatabase = () => {
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
  }
  if (db) {
    try {
      db.removeAllListeners();
      db.destroy();
    } catch (_) {
      /* ignore */
    }
  }

  db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    connectTimeout: 60000,
  });

  db.connect((err) => {
    if (err) {
      console.error('❌ Error conectando a MySQL:', err.message);
      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        console.error(
          '   → Revisa DB_HOST / puerto, VPN, firewall y que MySQL permita conexiones desde tu IP (p. ej. panel AlwaysData: acceso remoto).'
        );
      }
      scheduleReconnect();
      return;
    }
    console.log('✅ Conectado a MySQL');

    pingIntervalId = setInterval(() => {
      if (!db) return;
      db.ping((pingErr) => {
        if (pingErr) {
          console.error('⚠️ Error en el ping de MySQL:', pingErr.message);
        } else {
          console.log('✅ Ping enviado a MySQL para mantener la conexión activa.');
        }
      });
    }, 300000);
  });

  db.on('error', (err) => {
    console.error('🔥 Error en la conexión de MySQL:', err.message);
    if (RETRYABLE_DB_ERRORS.has(err.code)) {
      console.log('🔄 Reintentando conexión en 5s...');
      scheduleReconnect();
      return;
    }
    throw err;
  });
};

// Inicializar conexión a la base de datos
connectToDatabase();

// Middleware para asegurarse de que la conexión a MySQL se mantenga
app.use((req, res, next) => {
  if (!db) {
    connectToDatabase();
  }
  req.db = db; // Se pasa la conexión en `req.db`
  next();
});

// 🔹 Definir rutas API
app.use('/api/students', require('./routes/students'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/config', require('./routes/config'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/adjustments', require('./routes/adjustments'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/surplus-allocations', require('./routes/surplusAllocations'));

// Puerto del servidor
const PORT = process.env.PORT || 3004;
const DEPLOYED_URL = process.env.DEPLOYED_URL || `http://localhost:${PORT}`;

// Ruta para verificar si el servidor está corriendo
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Backend is running successfully!",
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en: ${DEPLOYED_URL}`);

  // Listar todas las rutas expuestas
  const endpoints = listEndpoints(app);
  console.log('📌 Rutas disponibles:');
  endpoints.forEach((endpoint) => {
    console.log(`- ${endpoint.methods.join(', ')} ${endpoint.path}`);
  });
});
