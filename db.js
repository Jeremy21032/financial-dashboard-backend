require('dotenv').config();
const mysql = require('mysql2');

/**
 * Pool de conexiones (recomendado para Vercel/serverless y desarrollo local).
 * Expone la misma API db.query(sql, params, callback) que usan las rutas.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error conectando a MySQL (pool):', err.message);
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('  → Revisa DB_HOST, credenciales y acceso remoto en AlwaysData.');
    }
  } else {
    console.log('✅ Pool MySQL listo (db.js)');
    connection.release();
  }
});

const db = {
  query(sql, params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    return pool.query(sql, params, cb);
  },
  getConnection(cb) {
    return pool.getConnection(cb);
  },
};

module.exports = db;
module.exports.pool = pool;
