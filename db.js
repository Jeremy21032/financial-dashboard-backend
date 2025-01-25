const mysql = require('mysql2');

// 🔹 Crear un pool de conexiones en lugar de una única conexión
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,  // Número máximo de conexiones simultáneas
  queueLimit: 0
});

// Exportar el pool con soporte para Promises
module.exports = pool.promise();
