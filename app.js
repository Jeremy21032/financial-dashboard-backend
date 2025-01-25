require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const listEndpoints = require('express-list-endpoints'); // Para listar endpoints
const cors = require("cors");
const db = require('./db'); // 🔹 Importar el pool de conexiones

const app = express();

// Habilitar CORS
app.use(cors());

// 🔹 Aumentar el límite del tamaño de las solicitudes
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Si usas body-parser explícitamente
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

// 🔹 Verificar conexión a MySQL al iniciar el servidor
db.getConnection()
  .then(() => console.log('✅ Conectado a MySQL con Pool de Conexiones'))
  .catch(err => console.error('❌ Error conectando a MySQL:', err.message));

// Definir rutas
app.use('/api/students', require('./routes/students'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/config', require('./routes/config'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/adjustments', require('./routes/adjustments'));

// Puerto del servidor
const PORT = process.env.PORT || 3004;
const DEPLOYED_URL = process.env.DEPLOYED_URL || `http://localhost:${PORT}`;

// Ruta de verificación del servidor
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
