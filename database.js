const { Pool } = require('pg');

// Pastikan DATABASE_URL tersedia
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL belum tersedia.');
  console.error('Pastikan DATABASE_URL sudah diatur di file .env atau Environment Variables Vercel.');
}

// Pool koneksi PostgreSQL / Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Supabase membutuhkan SSL untuk koneksi remote
  ssl: {
    rejectUnauthorized: false
  },

  // Cocok untuk environment serverless seperti Vercel
  max: 5,

  // Tutup koneksi idle setelah 30 detik
  idleTimeoutMillis: 30000,

  // Maksimal waktu mencoba koneksi
  connectionTimeoutMillis: 10000
});

// Tangani error pool agar server tidak langsung crash
pool.on('error', (err) => {
  console.error('❌ PostgreSQL Pool Error:', err.message);
});

/**
 * Tes koneksi database.
 * Dipanggil dari server.js ketika diperlukan.
 */
async function testConnection() {
  let client;

  try {
    client = await pool.connect();

    const result = await client.query(`
      SELECT
        NOW() AS waktu_server,
        current_database() AS database_name
    `);

    console.log('✅ Database Supabase berhasil terhubung.');
    console.log('Database:', result.rows[0].database_name);

    return {
      success: true,
      data: result.rows[0]
    };
  } catch (error) {
    console.error('❌ Gagal terhubung ke Supabase:');
    console.error(error.message);

    return {
      success: false,
      error: error.message
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  testConnection
};