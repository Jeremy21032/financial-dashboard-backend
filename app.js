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

const connectToDatabase = () => {
  db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true // Para ejecutar múltiples queries en una sola solicitud si es necesario
  });

  db.connect((err) => {
    if (err) {
      console.error('❌ Error conectando a MySQL:', err.message);
      setTimeout(connectToDatabase, 5000); // Reintento de conexión tras 5 segundos
    } else {
      console.log('✅ Conectado a MySQL');
    }
  });

  // Manejo de errores y reconexión
  db.on('error', (err) => {
    console.error('🔥 Error en la conexión de MySQL:', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('🔄 Reintentando conexión...');
      connectToDatabase();
    } else {
      throw err;
    }
  });

  // 🔹 Mantener la conexión activa enviando un "ping" cada 5 minutos
  setInterval(() => {
    db.ping((err) => {
      if (err) {
        console.error('⚠️ Error en el ping de MySQL:', err.message);
      } else {
        console.log('✅ Ping enviado a MySQL para mantener la conexión activa.');
      }
    });
  }, 150000); // 5 minutos
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
