require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 60000,
});

db.connect((err) => {
  if (err) {
    console.error('Error conectando a MySQL (db.js):', err.message);
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error(
        '  → Las rutas API usan esta conexión: revisa .env (DB_HOST) y acceso remoto al servidor MySQL.'
      );
    }
  } else {
    console.log('✅ Conectado a MySQL (db.js)');
  }
});

db.on('error', (err) => {
  console.error('Error en conexión MySQL (db.js):', err.message);
});

module.exports = db;
