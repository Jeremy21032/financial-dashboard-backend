require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const listEndpoints = require('express-list-endpoints'); // Librería para listar endpoints
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

// Conexión a MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('Error conectando a MySQL:', err.message);
  } else {
    console.log('Conectado a MySQL');
  }
});

// 🔹 Asegúrate de definir los middlewares ANTES de las rutas
app.use('/api/students', require('./routes/students'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/config', require('./routes/config'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/adjustments', require('./routes/adjustments'));

// Puerto del servidor
const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);

  // Listar todas las rutas expuestas
  const endpoints = listEndpoints(app);
  console.log('Rutas disponibles:');
  endpoints.forEach((endpoint) => {
    console.log(`- ${endpoint.methods.join(', ')} ${endpoint.path}`);
  });
});
