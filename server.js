require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);


const db = require('./database');

const app = express();



const PORT =
  process.env.PORT || 3000;


// ======================================================
// MULTER - UPLOAD CSV
// ======================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const ext =
      path
        .extname(file.originalname)
        .toLowerCase();

    if (ext !== '.csv') {
      return cb(
        new Error(
          'File harus berformat CSV.'
        )
      );
    }

    cb(null, true);
  }
});


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  session({
    store: new pgSession({
      pool: db.pool,
      tableName: 'session' // Pastikan tabel session sudah ada di DB
    }),
    secret: process.env.SESSION_SECRET || 'rahasia-atk-123',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 hari
      secure: false // set true jika menggunakan HTTPS
    }
  })
);


app.use(
  express.urlencoded({
    extended: true
  })
);


app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    ),
    { index: false }
  )
);

// ======================================================
// MIDDLEWARE AUTH (TAMBAHKAN INI)
// ======================================================

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};

const isKatim = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'katim') {
    return next();
  }
  res.status(403).json({ success: false, error: 'Akses khusus Katim.' });
};

const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  // Jika bukan admin, arahkan ke login atau beri error
  if (req.headers['accept']?.includes('application/json')) {
    return res.status(403).json({ success: false, error: 'Akses khusus Admin.' });
  }
  res.redirect('/login');
};

app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/katim', isAuthenticated, isKatim, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'katim.html'));
});
// ======================================================
// HALAMAN
// ======================================================
// GET /api/katim/peminjaman
app.get('/api/katim/peminjaman', isAuthenticated, isKatim, async (req, res) => {
  try {
    const bidang = req.session.user?.bidang;   // bidang Katim dari session
  const result = await db.query(`
  SELECT p.*,
    COALESCE(
      json_agg(
        json_build_object(
          'detail_id', d.id,
          'barang_id', d.barang_id,
          'nama', b.nama,
          'satuan', b.satuan,
          'jumlah', d.jumlah
        ) ORDER BY b.nama
      ) FILTER (WHERE d.id IS NOT NULL),
      '[]'
    ) AS items
  FROM peminjaman p
  LEFT JOIN detail_peminjaman d ON d.peminjaman_id = p.id
  LEFT JOIN barang b ON b.id = d.barang_id
  WHERE p.status = 'Menunggu Katim' AND p.bidang = $1 AND p.nomor_pinjam LIKE 'ATK-%'
    AND p.bidang = $1
  GROUP BY p.id
  ORDER BY p.tanggal DESC
`, [bidang]);

    res.json(result.rows);
  } catch (err) {
    console.error('Gagal ambil peminjaman Katim:', err);
    res.status(500).json({ success: false, error: 'Gagal ambil data.' });
  }
});

// -----------------------------------------------------
// 1️⃣ CRUD untuk tabel lab_barang
// -----------------------------------------------------

// GET semua barang lab (filter pencarian)
app.get('/api/lab/barang', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const result = await db.query(`
      SELECT id, kode, nama, satuan, stok
      FROM lab_barang
      WHERE kode ILIKE $1 OR nama ILIKE $1
      ORDER BY kode ASC
    `, [`%${search}%`]);
    res.json(result.rows);
  } catch (err) {
    console.error('Gagal ambil lab barang:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil data barang lab.' });
  }
});

// POST ajukan permintaan barang lab
app.post('/api/lab/peminjaman', async (req, res) => {
  let client;
  try {
    let { nama, bidang, keperluan, items } = req.body;

    nama = String(nama || '').trim();
    bidang = String(bidang || '').trim();
    keperluan = String(keperluan || '').trim();

    if (!nama || !bidang) {
      return res.status(400).json({ success: false, error: 'Nama dan bidang wajib diisi.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Pilih minimal satu barang lab.' });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    // Cek ketersediaan stok barang lab
    for (const item of items) {
      const barangId = Number.parseInt(item.barang_id, 10);
      const jumlah = Number.parseInt(item.jumlah, 10);

      const barangResult = await client.query(
        'SELECT id, nama, stok FROM lab_barang WHERE id = $1 FOR UPDATE',
        [barangId]
      );

      if (barangResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Barang lab tidak ditemukan.' });
      }

      const barang = barangResult.rows[0];
      if (Number(barang.stok) < jumlah) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Stok ${barang.nama} tidak mencukupi. Tersedia: ${barang.stok}.`
        });
      }
    }

    // Buat nomor registrasi peminjaman LAB
    const tahun = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const nomorPinjam = `LAB-${tahun}-${random}`;

    // Simpan data peminjaman
    const peminjaman = await client.query(
      `INSERT INTO peminjaman (nomor_pinjam, nama_peminjam, email, bidang, keperluan, status)
       VALUES ($1, $2, '', $3, $4, 'Menunggu Katim')
       RETURNING id`,
      [nomorPinjam, nama, bidang, keperluan]
    );

    const peminjamanId = peminjaman.rows[0].id;

    // Simpan detail barang lab
    for (const item of items) {
      await client.query(
        `INSERT INTO detail_peminjaman (peminjaman_id, barang_id, jumlah)
         VALUES ($1, $2, $3)`,
        [peminjamanId, item.barang_id, item.jumlah]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: 'Permintaan lab berhasil dikirim.',
      nomor_pinjam: nomorPinjam
    });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('Gagal simpan permintaan lab:', error);
    res.status(500).json({ success: false, error: 'Gagal memproses permintaan lab.' });
  } finally {
    if (client) client.release();
  }
});

// POST tambah barang lab
app.post('/api/admin/lab/barang/tambah', isAuthenticated, async (req, res) => {
  let { kode, nama, satuan, stok } = req.body;
  kode = String(kode || '').trim().toUpperCase();
  nama = String(nama || '').trim();
  satuan = String(satuan || '').trim();
  stok = Number.parseInt(stok, 10);

  if (!kode || !nama || !satuan) {
    return res.status(400).json({ success: false, error: 'Kode, nama, dan satuan wajib diisi.' });
  }
  if (!Number.isInteger(stok) || stok < 0) {
    return res.status(400).json({ success: false, error: 'Stok harus angka ≥0.' });
  }

  try {
    const result = await db.query(`
      INSERT INTO lab_barang (kode, nama, satuan, stok)
      VALUES ($1,$2,$3,$4)
      RETURNING id, kode, nama, satuan, stok
    `, [kode, nama, satuan, stok]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505')
      return res.status(409).json({ success: false, error: 'Kode barang sudah digunakan.' });
    console.error('Tambah barang lab gagal:', error);
    res.status(500).json({ success: false, error: 'Gagal menambahkan barang lab.' });
  }
});

// POST update stok lab
app.post('/api/admin/lab/barang/update-stok', isAuthenticated, async (req, res) => {
  const id   = Number.parseInt(req.body.id, 10);
  const stok = Number.parseInt(req.body.stok, 10);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ success: false, error: 'ID barang tidak valid.' });
  if (!Number.isInteger(stok) || stok < 0)
    return res.status(400).json({ success: false, error: 'Stok harus angka ≥0.' });

  try {
    const result = await db.query(`
      UPDATE lab_barang SET stok = $1 WHERE id = $2
      RETURNING id, kode, nama, satuan, stok
    `, [stok, id]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Barang lab tidak ditemukan.' });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update stok lab gagal:', err);
    res.status(500).json({ success: false, error: 'Gagal memperbarui stok lab.' });
  }
});

// DELETE barang lab
app.delete('/api/admin/lab/barang/:id', isAuthenticated, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ success: false, error: 'ID barang tidak valid.' });

  // Cek apakah barang sudah pernah dipakai di detail_peminjaman
  const used = await db.query(`
    SELECT 1 FROM detail_peminjaman WHERE barang_id = $1 LIMIT 1
  `, [id]);
  if (used.rows.length > 0)
    return res.status(400).json({ success: false, error: 'Barang tidak dapat dihapus karena sudah tercatat dalam riwayat permintaan.' });

  try {
    const result = await db.query(`
      DELETE FROM lab_barang WHERE id = $1 RETURNING id
    `, [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Barang lab tidak ditemukan.' });
    res.json({ success: true, message: 'Barang lab berhasil dihapus.' });
  } catch (err) {
    console.error('Hapus barang lab gagal:', err);
    res.status(500).json({ success: false, error: 'Gagal menghapus barang lab.' });
  }
});

// -----------------------------------------------------
// 2️⃣ Katim – Permintaan Lab (mirip ATK)
// -----------------------------------------------------

// GET permintaan lab untuk Katim
app.get('/api/katim/lab/peminjaman', isAuthenticated, isKatim, async (req, res) => {
  try {
    const bidang = req.session.user?.bidang;
    const result = await db.query(`
      SELECT p.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'detail_id', d.id,
              'barang_id', d.barang_id,
              'nama', b.nama,
              'satuan', b.satuan,
              'jumlah', d.jumlah
            ) ORDER BY b.nama
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'
        ) AS items
      FROM peminjaman p
      LEFT JOIN detail_peminjaman d ON d.peminjaman_id = p.id
      LEFT JOIN lab_barang b ON b.id = d.barang_id   -- <<‑ perbedaan
      WHERE p.status = 'Menunggu Katim' AND p.bidang = $1 AND p.nomor_pinjam LIKE 'LAB-%'
      GROUP BY p.id
      ORDER BY p.tanggal DESC
    `, [bidang]);
    res.json(result.rows);
  } catch (err) {
    console.error('Gagal ambil peminjaman Katim (lab):', err);
    res.status(500).json({ success: false, error: 'Gagal ambil data.' });
  }
});

// POST proses persetujuan lab (mirip ATK)
app.post('/api/katim/lab/peminjaman/proses', isAuthenticated, isKatim, async (req, res) => {
  const { id, status, catatan, items } = req.body;   // status: 'Disetujui Katim' atau 'Ditolak Katim'
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE peminjaman SET status = $1, catatan_katim = $2 WHERE id = $3',
      [status, catatan, id]
    );

    if (status === 'Disetujui Katim' && items) {
      for (const item of items) {
        await client.query(
          'UPDATE detail_peminjaman SET jumlah = $1 WHERE id = $2',
          [item.jumlah, item.detail_id]
        );
        // Decrease stock for lab barang
        await client.query(
          'UPDATE lab_barang SET stok = stok - $1 WHERE id = $2',
          [item.jumlah, item.barang_id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Berhasil di-${status}` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Proses Katim lab error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});


// 3. API Proses Persetujuan Katim
app.post('/api/katim/peminjaman/proses', isAuthenticated, isKatim, async (req, res) => {
  const { id, status, catatan, items } = req.body; 
  // status: 'Disetujui Katim' atau 'Ditolak Katim'
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Update Header
    await client.query(
      'UPDATE peminjaman SET status = $1, catatan_katim = $2 WHERE id = $3',
      [status, catatan, id]
    );

    // Jika disetujui Katim, kita bisa update jumlah jika Katim mengubahnya
    if (status === 'Disetujui Katim' && items) {
      for (const item of items) {
        await client.query(
          'UPDATE detail_peminjaman SET jumlah = $1 WHERE id = $2',
          [item.jumlah, item.detail_id]
        );
        // Decrease stock for ATK barang
        await client.query(
          'UPDATE barang SET stok = stok - $1 WHERE id = $2',
          [item.jumlah, item.barang_id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Berhasil di-${status}` });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

 // ======================================================
 // HALAMAN
 // ======================================================

 app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'landing.html')
  );
});

// Form permintaan barang
app.get(['/form', '/permintaan'], (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

// Login Admin dan Katim
app.get('/login', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'login.html')
  );
});

// Halaman Admin


const bcrypt = require('bcryptjs');

// Login Admin dan Katim
app.post('/api/login', async (req, res) => {
  try {
        const { username, password, role, bidang: bidangDipilih } = req.body;
    
    // DEBUG: Baris ini untuk melihat apa yang dikirim dari form
    console.log('Mencoba Login:', { username, role });

    const result = await db.query(
      'SELECT * FROM pengguna WHERE username = $1 AND role = $2',
      [username, role]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Akun tidak ditemukan.' });
    }

    const user = result.rows[0];
    
    // DEBUG: Baris ini untuk membandingkan password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log('Password Match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Password salah.' });
    }

        // Gunakan bidang yang dipilih dari form login jika ada, atau fallback ke bidang di tabel pengguna
    const bidangFinal = user.role === 'katim' ? (bidangDipilih || user.bidang || null) : null;

    req.session.user = { 
      id: user.id, 
      username: user.username, 
      role: user.role, 
      bidang: bidangFinal 
    };

    // Pastikan session tersimpan sebelum kirim respon
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, error: 'Gagal membuat sesi login.' });
      }
      res.json({ success: true, message: 'Login berhasil', role: user.role });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server.' });
  }
});

// ======================================================
// API AUTHENTICATION
// ======================================================


app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/admin');
    }
    res.clearCookie('connect.sid'); // Nama default cookie session
    res.redirect('/login');
  });
});


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  '/api/health',
  async (req, res) => {
    try {
      const result =
        await db.query(`
          SELECT
            NOW() AS waktu
        `);

      res.json({
        success: true,

        message:
          'Server dan database Supabase terhubung.',

        waktu:
          result.rows[0].waktu
      });

    } catch (error) {
      console.error(
        'Health check gagal:',
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          'Database tidak dapat dihubungi.'
      });
    }
  }
);


// ======================================================
// BARANG - LIST
// ======================================================

app.get(
  '/api/barang',
  async (req, res) => {
    try {
      const search =
        String(
          req.query.search || ''
        ).trim();

      const result =
        await db.query(
          `
          SELECT
            id,
            kode,
            nama,
            satuan,
            stok

          FROM barang

          WHERE
            kode ILIKE $1
            OR nama ILIKE $1

          ORDER BY
            CASE
              WHEN kode ~ '[0-9]+'
                THEN CAST(
                  SUBSTRING(
                    kode FROM '[0-9]+'
                  )
                  AS INTEGER
                )
              ELSE 999999
            END ASC,
            kode ASC
          `,
          [
            `%${search}%`
          ]
        );

      res.json(
        result.rows
      );

    } catch (error) {
      console.error(
        'Gagal mengambil barang:',
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil data barang.'
      });
    }
  }
);


// ======================================================
// ADMIN - TAMBAH BARANG
// ======================================================

app.post(
  '/api/admin/barang/tambah',
  isAuthenticated,
  async (req, res) => {
    try {
      let {
        kode,
        nama,
        satuan,
        stok
      } = req.body;


      kode =
        String(kode || '')
          .trim()
          .toUpperCase();


      nama =
        String(nama || '')
          .trim();


      satuan =
        String(satuan || '')
          .trim();


      stok =
        Number.parseInt(
          stok,
          10
        );


      if (
        !kode ||
        !nama ||
        !satuan
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Kode, nama, dan satuan wajib diisi.'
          });
      }


      if (
        !Number.isInteger(stok) ||
        stok < 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Stok harus berupa angka 0 atau lebih.'
          });
      }


      const result =
        await db.query(
          `
          INSERT INTO barang (
            kode,
            nama,
            satuan,
            stok
          )

          VALUES (
            $1,
            $2,
            $3,
            $4
          )

          RETURNING
            id,
            kode,
            nama,
            satuan,
            stok
          `,
          [
            kode,
            nama,
            satuan,
            stok
          ]
        );


      res.status(201).json({
        success: true,

        message:
          'Barang berhasil ditambahkan.',

        data:
          result.rows[0]
      });

    } catch (error) {
      if (
        error.code === '23505'
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              'Kode barang sudah digunakan.'
          });
      }


      console.error(
        'Tambah barang gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal menambahkan barang.'
      });
    }
  }
);


// ======================================================
// ADMIN - UPDATE STOK
// ======================================================

app.post(
  '/api/admin/barang/update-stok',
  isAuthenticated,
  async (req, res) => {
    try {
      const id =
        Number.parseInt(
          req.body.id,
          10
        );


      const stok =
        Number.parseInt(
          req.body.stok,
          10
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'ID barang tidak valid.'
          });
      }


      if (
        !Number.isInteger(stok) ||
        stok < 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Stok harus berupa angka 0 atau lebih.'
          });
      }


      const result =
        await db.query(
          `
          UPDATE barang

          SET
            stok = $1

          WHERE
            id = $2

          RETURNING
            id,
            kode,
            nama,
            satuan,
            stok
          `,
          [
            stok,
            id
          ]
        );


      if (
        result.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              'Barang tidak ditemukan.'
          });
      }


      res.json({
        success: true,

        message:
          'Stok berhasil diperbarui.',

        data:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        'Update stok gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal memperbarui stok.'
      });
    }
  }
);


// ======================================================
// ADMIN - HAPUS BARANG
// ======================================================

app.delete(
  '/api/admin/barang/:id',
  isAuthenticated,
  async (req, res) => {
    try {
      const id =
        Number.parseInt(
          req.params.id,
          10
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'ID barang tidak valid.'
          });
      }


      const digunakan =
        await db.query(
          `
          SELECT
            id

          FROM detail_peminjaman

          WHERE
            barang_id = $1

          LIMIT 1
          `,
          [id]
        );


      if (
        digunakan.rows.length > 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Barang tidak dapat dihapus karena sudah tercatat dalam riwayat permintaan.'
          });
      }


      const result =
        await db.query(
          `
          DELETE FROM barang

          WHERE
            id = $1

          RETURNING id
          `,
          [id]
        );


      if (
        result.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              'Barang tidak ditemukan.'
          });
      }


      res.json({
        success: true,

        message:
          'Barang berhasil dihapus.'
      });

    } catch (error) {
      console.error(
        'Hapus barang gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal menghapus barang.'
      });
    }
  }
);


// ======================================================
// CSV - DETEKSI DELIMITER
// ======================================================

function detectDelimiter(text) {
  const firstLine =
    text
      .split(/\r?\n/)
      .find(
        line =>
          line.trim() !== ''
      ) || '';


  const comma =
    (
      firstLine.match(/,/g) ||
      []
    ).length;


  const semicolon =
    (
      firstLine.match(/;/g) ||
      []
    ).length;


  return semicolon > comma
    ? ';'
    : ',';
}


// ======================================================
// CSV - PARSER
// ======================================================

function parseCSV(text) {
  text =
    String(text || '')
      .replace(/^\uFEFF/, '');


  const delimiter =
    detectDelimiter(text);


  const rows = [];

  let row = [];
  let field = '';

  let insideQuotes = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    const char =
      text[i];

    const next =
      text[i + 1];


    if (char === '"') {
      if (
        insideQuotes &&
        next === '"'
      ) {
        field += '"';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }


    if (
      char === delimiter &&
      !insideQuotes
    ) {
      row.push(field);

      field = '';

      continue;
    }


    if (
      (
        char === '\n' ||
        char === '\r'
      ) &&
      !insideQuotes
    ) {
      if (
        char === '\r' &&
        next === '\n'
      ) {
        i++;
      }


      row.push(field);


      const isEmpty =
        row.every(
          value =>
            String(value)
              .trim() === ''
        );


      if (!isEmpty) {
        rows.push(row);
      }


      row = [];
      field = '';

      continue;
    }


    field += char;
  }


  if (
    field.length > 0 ||
    row.length > 0
  ) {
    row.push(field);


    const isEmpty =
      row.every(
        value =>
          String(value)
            .trim() === ''
      );


    if (!isEmpty) {
      rows.push(row);
    }
  }


  return rows;
}


// ======================================================
// CSV - NORMALISASI HEADER
// ======================================================

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(
      /[^a-z0-9_]/g,
      ''
    );
}


// ======================================================
// ADMIN - IMPORT CSV
// ======================================================

app.post(
  '/api/admin/barang/import',

  upload.single('file'),

  async (req, res) => {
    let client;

    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'File CSV belum dipilih.'
          });
      }


      const csvText =
        req.file.buffer
          .toString('utf8');


      const rows =
        parseCSV(csvText);


      if (
        rows.length < 2
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'CSV kosong atau tidak memiliki data.'
          });
      }


      const headers =
        rows[0]
          .map(
            normalizeHeader
          );


      const kodeIndex =
        headers.indexOf('kode');

      const namaIndex =
        headers.indexOf('nama');

      const satuanIndex =
        headers.indexOf('satuan');

      const stokIndex =
        headers.indexOf('stok');


      if (
        kodeIndex === -1 ||
        namaIndex === -1 ||
        satuanIndex === -1 ||
        stokIndex === -1
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Format CSV tidak sesuai. Header wajib: kode,nama,satuan,stok'
          });
      }


      const validRows = [];
      const errors = [];


      for (
        let i = 1;
        i < rows.length;
        i++
      ) {
        const row =
          rows[i];


        const nomorBaris =
          i + 1;


        const kode =
          String(
            row[kodeIndex] || ''
          )
            .trim()
            .toUpperCase();


        const nama =
          String(
            row[namaIndex] || ''
          )
            .trim();


        const satuan =
          String(
            row[satuanIndex] || ''
          )
            .trim();


        const stokText =
          String(
            row[stokIndex] || ''
          )
            .trim();


        const stok =
          Number(stokText);


        if (
          !kode &&
          !nama &&
          !satuan &&
          !stokText
        ) {
          continue;
        }


        if (!kode) {
          errors.push({
            baris:
              nomorBaris,

            error:
              'Kode barang kosong.'
          });

          continue;
        }


        if (!nama) {
          errors.push({
            baris:
              nomorBaris,

            kode,

            error:
              'Nama barang kosong.'
          });

          continue;
        }


        if (!satuan) {
          errors.push({
            baris:
              nomorBaris,

            kode,

            error:
              'Satuan kosong.'
          });

          continue;
        }


        if (
          stokText === '' ||
          !Number.isInteger(stok) ||
          stok < 0
        ) {
          errors.push({
            baris:
              nomorBaris,

            kode,

            error:
              'Stok harus berupa angka bulat 0 atau lebih.'
          });

          continue;
        }


        validRows.push({
          kode,
          nama,
          satuan,
          stok
        });
      }


      if (
        validRows.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Tidak ada data valid yang dapat diimpor.',

            errors
          });
      }


      const seen =
        new Set();


      const duplicateCodes =
        new Set();


      for (
        const item of validRows
      ) {
        if (
          seen.has(item.kode)
        ) {
          duplicateCodes.add(
            item.kode
          );
        }

        seen.add(
          item.kode
        );
      }


      if (
        duplicateCodes.size > 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Terdapat kode barang ganda di dalam file CSV.',

            duplicates:
              Array.from(
                duplicateCodes
              )
          });
      }


      client =
        await db.pool.connect();


      await client.query(
        'BEGIN'
      );


      let inserted = 0;
      let updated = 0;


      for (
        const item of validRows
      ) {
        const existing =
          await client.query(
            `
            SELECT
              id

            FROM barang

            WHERE
              LOWER(kode)
              =
              LOWER($1)

            LIMIT 1
            `,
            [
              item.kode
            ]
          );


        if (
          existing.rows.length > 0
        ) {
          await client.query(
            `
            UPDATE barang

            SET
              nama = $1,
              satuan = $2,
              stok = $3

            WHERE
              id = $4
            `,
            [
              item.nama,
              item.satuan,
              item.stok,
              existing.rows[0].id
            ]
          );


          updated++;

        } else {
          await client.query(
            `
            INSERT INTO barang (
              kode,
              nama,
              satuan,
              stok
            )

            VALUES (
              $1,
              $2,
              $3,
              $4
            )
            `,
            [
              item.kode,
              item.nama,
              item.satuan,
              item.stok
            ]
          );


          inserted++;
        }
      }


      await client.query(
        'COMMIT'
      );


      res.json({
        success: true,

        message:
          'Import data barang berhasil.',

        summary: {
          total_baris:
            rows.length - 1,

          valid:
            validRows.length,

          ditambahkan:
            inserted,

          diperbarui:
            updated,

          gagal:
            errors.length
        },

        errors
      });

    } catch (error) {
      if (client) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch (_) {}
      }


      console.error(
        'Import CSV gagal:',
        error
      );


      res.status(500).json({
        success: false,

        error:
          error.message ||
          'Gagal mengimpor file CSV.'
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ======================================================
// PERMINTAAN ATK
// ======================================================

app.post(
  '/api/peminjaman',
  async (req, res) => {
    let client;

    try {
      let {
        nama,
        bidang,
        keperluan,
        items
      } = req.body;


      // ------------------------------------------
      // NORMALISASI
      // ------------------------------------------

      nama =
        String(nama || '')
          .trim();


      bidang =
        String(bidang || '')
          .trim();


      keperluan =
        String(keperluan || '')
          .trim();


      // ------------------------------------------
      // VALIDASI WAJIB
      // ------------------------------------------

      if (
        !nama ||
        !bidang
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Nama dan bidang wajib diisi.'
          });
      }


      // ------------------------------------------
      // VALIDASI BIDANG
      // ------------------------------------------

      const bidangValid = [
        'Tata Usaha',
        'Pemeriksaan',
        'Penindakan',
        'Infokom'
      ];


      if (
        !bidangValid.includes(
          bidang
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Bidang / unit kerja tidak valid.'
          });
      }


      // ------------------------------------------
      // VALIDASI BARANG
      // ------------------------------------------

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Pilih minimal satu barang.'
          });
      }


      const itemMap =
        new Map();


      for (
        const item of items
      ) {
        const barangId =
          Number.parseInt(
            item.barang_id,
            10
          );


        const jumlah =
          Number.parseInt(
            item.jumlah,
            10
          );


        if (
          !Number.isInteger(
            barangId
          ) ||
          barangId <= 0 ||
          !Number.isInteger(
            jumlah
          ) ||
          jumlah <= 0
        ) {
          return res
            .status(400)
            .json({
              success: false,

              error:
                'Data barang tidak valid.'
            });
        }


        itemMap.set(
          barangId,

          (
            itemMap.get(
              barangId
            ) || 0
          ) + jumlah
        );
      }


      const normalizedItems =
        Array.from(
          itemMap.entries()
        )
          .map(
            (
              [
                barang_id,
                jumlah
              ]
            ) => ({
              barang_id,
              jumlah
            })
          );


      // ------------------------------------------
      // DATABASE TRANSACTION
      // ------------------------------------------

      client =
        await db.pool.connect();


      await client.query(
        'BEGIN'
      );


      // ------------------------------------------
      // CEK STOK
      // ------------------------------------------

      for (
        const item of normalizedItems
      ) {
        const barangResult =
          await client.query(
            `
            SELECT
              id,
              nama,
              stok

            FROM barang

            WHERE
              id = $1

            FOR UPDATE
            `,
            [
              item.barang_id
            ]
          );


        if (
          barangResult.rows.length ===
          0
        ) {
          await client.query(
            'ROLLBACK'
          );


          return res
            .status(404)
            .json({
              success: false,

              error:
                'Barang tidak ditemukan.'
            });
        }


        const barang =
          barangResult.rows[0];


        if (
          Number(barang.stok) <
          item.jumlah
        ) {
          await client.query(
            'ROLLBACK'
          );


          return res
            .status(400)
            .json({
              success: false,

              error:
                `Stok ${barang.nama} tidak mencukupi. Stok tersedia: ${barang.stok}.`
            });
        }
      }


      // ------------------------------------------
      // NOMOR PERMINTAAN
      // ------------------------------------------

      const now =
        new Date();


      const tahun =
        now.getFullYear();


      const random =
        Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();


      const nomorPinjam =
        `ATK-${tahun}-${random}`;


      // ------------------------------------------
      // SIMPAN HEADER
      // ------------------------------------------

      const peminjaman =
        await client.query(
          `
          INSERT INTO peminjaman (
            nomor_pinjam,
            nama_peminjam,
            email,
            bidang,
            keperluan,
            status
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'Menunggu Katim'
          )

          RETURNING
            id
          `,
          [
            nomorPinjam,
            nama,

            // email tidak dipakai lagi,
            // tetapi kolom DB tetap diisi string kosong
            // agar kompatibel bila kolom email NOT NULL.
            '',

            bidang,

            // keperluan opsional
            keperluan || ''
          ]
        );


      const peminjamanId =
        peminjaman.rows[0].id;


      // ------------------------------------------
      // SIMPAN DETAIL
      // ------------------------------------------

      for (
        const item of normalizedItems
      ) {
        await client.query(
          `
          INSERT INTO detail_peminjaman (
            peminjaman_id,
            barang_id,
            jumlah
          )

          VALUES (
            $1,
            $2,
            $3
          )
          `,
          [
            peminjamanId,
            item.barang_id,
            item.jumlah
          ]
        );
      }


      await client.query(
        'COMMIT'
      );


      res.status(201).json({
        success: true,

        message:
          'Permintaan berhasil dikirim.',

        nomor_pinjam:
          nomorPinjam
      });

    } catch (error) {
      if (client) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch (_) {}
      }


      console.error(
        'Permintaan gagal:',
        error
      );


      res.status(500).json({
        success: false,

        error:
          'Terjadi kesalahan saat menyimpan permintaan.'
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ======================================================
// ADMIN - DAFTAR PERMINTAAN
// ======================================================

app.get(
  '/api/admin/peminjaman',
  isAuthenticated,
  async (req, res) => {
    try {
      const result =
        await db.query(
          `
          SELECT
            p.id,
            p.nomor_pinjam,
            p.nama_peminjam,
            p.email,
            p.bidang,
            p.keperluan,
            p.status,
            p.tanggal,

            COALESCE(
              STRING_AGG(
                b.nama ||
                ' (' ||
                dp.jumlah ||
                ' ' ||
                b.satuan ||
                ')',
                ', '
                ORDER BY b.nama
              ),
              '-'
            ) AS item_list,

            COALESCE(
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'detail_id', dp.id,
      'nama', b.nama,
      'satuan', b.satuan,
      'jumlah_diminta', dp.jumlah,
      'jumlah_disetujui', COALESCE(dp.jumlah_disetujui, 0)
    )
    ORDER BY b.nama, dp.id
  ) FILTER (WHERE dp.id IS NOT NULL),
  '[]'::jsonb
) AS items

                    FROM peminjaman p

          LEFT JOIN detail_peminjaman dp
            ON
              dp.peminjaman_id =
              p.id

          LEFT JOIN barang b
            ON
              b.id =
              dp.barang_id

          WHERE p.nomor_pinjam LIKE 'ATK-%'

          GROUP BY
            p.id,
            p.nomor_pinjam,
            p.nama_peminjam,
            p.email,
            p.bidang,
            p.keperluan,
            p.status,
            p.tanggal

          ORDER BY
            CASE
              WHEN p.status = 'Disetujui Katim'
                THEN 1

              WHEN p.status = 'Menunggu Katim'
                THEN 2

              WHEN p.status = 'Disetujui'
                THEN 3

              ELSE 4
            END,

            p.tanggal DESC
          `
        );


      res.json(
        result.rows
      );

    } catch (error) {
      console.error(
        'Daftar permintaan gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil daftar permintaan.'
      });
    }
  }
);

// ======================================================
// ADMIN - DAFTAR PERMINTAAN LAB
// ======================================================
app.get('/api/admin/lab/peminjaman', isAuthenticated, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.id,
        p.nomor_pinjam,
        p.nama_peminjam,
        p.email,
        p.bidang,
        p.keperluan,
        p.status,
        p.tanggal,
        COALESCE(
          STRING_AGG(
            b.nama || ' (' || dp.jumlah || ' ' || b.satuan || ')',
            ', '
            ORDER BY b.nama
          ),
          '-'
        ) AS item_list,
        COALESCE(
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'detail_id', dp.id,
              'nama', b.nama,
              'satuan', b.satuan,
              'jumlah_diminta', dp.jumlah,
              'jumlah_disetujui', COALESCE(dp.jumlah_disetujui, 0)
            )
            ORDER BY b.nama, dp.id
          ) FILTER (WHERE dp.id IS NOT NULL),
          '[]'::jsonb
        ) AS items
      FROM peminjaman p
      LEFT JOIN detail_peminjaman dp ON dp.peminjaman_id = p.id
      LEFT JOIN lab_barang b ON b.id = dp.barang_id
      WHERE p.nomor_pinjam LIKE 'LAB-%'
      GROUP BY p.id
      ORDER BY
        CASE
          WHEN p.status = 'Disetujui Katim' THEN 1
          WHEN p.status = 'Menunggu Katim' THEN 2
          WHEN p.status = 'Disetujui' THEN 3
          ELSE 4
        END,
        p.tanggal DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Gagal ambil permintaan lab admin:', error.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil data permintaan lab.' });
  }
});


// ======================================================
// ADMIN - DETAIL PERMINTAAN
// ======================================================

app.get(
  '/api/admin/peminjaman/:id',
  isAuthenticated,
  async (req, res) => {
    try {
      const id =
        Number.parseInt(
          req.params.id,
          10
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'ID tidak valid.'
          });
      }


      const peminjaman =
        await db.query(
          `
          SELECT
            id,
            nomor_pinjam,
            nama_peminjam,
            email,
            bidang,
            keperluan,
            status,
            tanggal

          FROM peminjaman

          WHERE
            id = $1
          `,
          [id]
        );


      if (
        peminjaman.rows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              'Permintaan tidak ditemukan.'
          });
      }


      const items =
        await db.query(
          `
          SELECT
  dp.id,
  dp.barang_id,
  dp.jumlah,
  dp.jumlah_disetujui,

  b.kode,
            b.nama,
            b.satuan,
            b.stok

          FROM detail_peminjaman dp

          JOIN barang b
            ON
              b.id =
              dp.barang_id

          WHERE
            dp.peminjaman_id = $1

          ORDER BY
            CASE
              WHEN b.kode ~ '[0-9]+'
                THEN CAST(
                  SUBSTRING(
                    b.kode FROM '[0-9]+'
                  )
                  AS INTEGER
                )
              ELSE 999999
            END ASC,
            b.kode ASC
          `,
          [id]
        );


      res.json({
        success: true,

        peminjaman:
          peminjaman.rows[0],

        items:
          items.rows
      });

    } catch (error) {
      console.error(
        'Detail permintaan gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil detail permintaan.'
      });
    }
  }
);


// ======================================================
// ADMIN - UPDATE STATUS PERMINTAAN
// ======================================================

app.post(
  '/api/admin/peminjaman/status',
  isAuthenticated,
  async (req, res) => {
    let client;

    try {
      const id =
        Number.parseInt(
          req.body.id,
          10
        );

      const status =
        String(
          req.body.status || ''
        ).trim();

      const approvalItems =
        Array.isArray(req.body.items)
          ? req.body.items
          : null;

           const allowed = [
        'Menunggu Katim',
        'Disetujui Katim',
        'Ditolak Katim',
        'Pending',
        'Disetujui',
        'Ditolak'
      ];


      if (
        !Number.isInteger(id) ||
        id <= 0 ||
        !allowed.includes(status)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Data status tidak valid.'
          });
      }


      client =
        await db.pool.connect();

      await client.query('BEGIN');


      // ==============================================
      // LOCK PERMINTAAN
      // ==============================================

      const current =
        await client.query(
          `
          SELECT
            id,
            status

          FROM peminjaman

          WHERE id = $1

          FOR UPDATE
          `,
          [id]
        );

         if (
        current.rows.length === 0
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(404)
          .json({
            success: false,
            error:
              'Permintaan tidak ditemukan.'
          });
      }

        if (status === 'Disetujui' && !['Disetujui Katim', 'Disetujui'].includes(current.rows[0].status)) {
  await client.query('ROLLBACK');
  return res.status(400).json({ 
      success: false, 
      error: 'Permintaan harus disetujui oleh Ketua Tim terlebih dahulu.' 
  });
}

     


      const oldStatus =
        current.rows[0].status;


      // ==============================================
      // AMBIL DETAIL + LOCK BARANG
      // ==============================================

      const detailResult =
        await client.query(
          `
          SELECT
            dp.id AS detail_id,
            dp.barang_id,
            dp.jumlah,
            dp.jumlah_disetujui,

            b.nama,
            b.stok

          FROM detail_peminjaman dp

          JOIN barang b
            ON b.id = dp.barang_id

          WHERE
            dp.peminjaman_id = $1

          ORDER BY dp.id

          FOR UPDATE OF dp, b
          `,
          [id]
        );


      const details =
        detailResult.rows;


      // ==============================================
      // STATUS DISETUJUI
      // ==============================================

      if (
        status === 'Disetujui'
      ) {
        const approvalMap =
          new Map();


        // Jika frontend mengirim jumlah persetujuan,
        // gunakan nilai tersebut.
        if (approvalItems) {
          for (
            const item of approvalItems
          ) {
            const detailId =
              Number.parseInt(
                item.detail_id,
                10
              );

            const jumlahDisetujui =
              Number.parseInt(
                item.jumlah_disetujui,
                10
              );


            if (
              !Number.isInteger(
                detailId
              ) ||
              !Number.isInteger(
                jumlahDisetujui
              ) ||
              jumlahDisetujui < 0
            ) {
              await client.query(
                'ROLLBACK'
              );

              return res
                .status(400)
                .json({
                  success: false,
                  error:
                    'Jumlah persetujuan tidak valid.'
                });
            }


            approvalMap.set(
              detailId,
              jumlahDisetujui
            );
          }
        }


        let totalDisetujui = 0;


        for (
          const detail of details
        ) {
          const jumlahPermintaan =
            Number(
              detail.jumlah
            );

          const jumlahLama =
            oldStatus === 'Disetujui'
              ? Number(
                  detail.jumlah_disetujui
                )
              : 0;


          // Jika frontend belum mengirim items,
          // setujui penuh agar kompatibel
          // dengan tombol admin lama.
          const jumlahBaru =
            approvalItems
              ? (
                  approvalMap.has(
                    Number(
                      detail.detail_id
                    )
                  )
                    ? Number(
                        approvalMap.get(
                          Number(
                            detail.detail_id
                          )
                        )
                      )
                    : 0
                )
              : jumlahPermintaan;


          if (
            jumlahBaru >
            jumlahPermintaan
          ) {
            await client.query(
              'ROLLBACK'
            );

            return res
              .status(400)
              .json({
                success: false,

                error:
                  `Jumlah disetujui untuk ${detail.nama} tidak boleh melebihi jumlah permintaan (${jumlahPermintaan}).`
              });
          }


          const selisih =
            jumlahBaru -
            jumlahLama;


          // Jika persetujuan bertambah,
          // stok harus cukup.
          if (
            selisih > 0 &&
            Number(detail.stok) <
            selisih
          ) {
            await client.query(
              'ROLLBACK'
            );

            return res
              .status(400)
              .json({
                success: false,

                error:
                  `Stok ${detail.nama} tidak mencukupi. Stok tersedia: ${detail.stok}.`
              });
          }


          // Persetujuan bertambah:
          // kurangi stok.
          if (
            selisih > 0
          ) {
            await client.query(
              `
              UPDATE barang

              SET
                stok =
                  stok - $1

              WHERE
                id = $2
              `,
              [
                selisih,
                detail.barang_id
              ]
            );
          }


          // Persetujuan berkurang:
          // kembalikan stok.
          if (
            selisih < 0
          ) {
            await client.query(
              `
              UPDATE barang

              SET
                stok =
                  stok + $1

              WHERE
                id = $2
              `,
              [
                Math.abs(selisih),
                detail.barang_id
              ]
            );
          }


          await client.query(
            `
            UPDATE detail_peminjaman

            SET
              jumlah_disetujui = $1

            WHERE
              id = $2
            `,
            [
              jumlahBaru,
              detail.detail_id
            ]
          );


          totalDisetujui +=
            jumlahBaru;
        }


        // Tidak boleh status Disetujui
        // jika semua item bernilai 0.
        if (
          totalDisetujui === 0
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(400)
            .json({
              success: false,

              error:
                'Minimal satu barang harus memiliki jumlah disetujui lebih dari 0.'
            });
        }
      }


      // ==============================================
      // DISETUJUI -> PENDING / DITOLAK
      // ==============================================

      if (
        oldStatus === 'Disetujui' &&
        status !== 'Disetujui'
      ) {
        for (
          const detail of details
        ) {
          const jumlahLama =
            Number(
              detail.jumlah_disetujui
            );


          if (
            jumlahLama > 0
          ) {
            await client.query(
              `
              UPDATE barang

              SET
                stok =
                  stok + $1

              WHERE
                id = $2
              `,
              [
                jumlahLama,
                detail.barang_id
              ]
            );
          }


          await client.query(
            `
            UPDATE detail_peminjaman

            SET
              jumlah_disetujui = 0

            WHERE
              id = $1
            `,
            [
              detail.detail_id
            ]
          );
        }
      }


      // ==============================================
      // PENDING / DITOLAK
      // ==============================================

      if (
        oldStatus !== 'Disetujui' &&
        status !== 'Disetujui'
      ) {
        await client.query(
          `
          UPDATE detail_peminjaman

          SET
            jumlah_disetujui = 0

          WHERE
            peminjaman_id = $1
          `,
          [id]
        );
      }


      // ==============================================
      // UPDATE STATUS
      // ==============================================

      await client.query(
        `
        UPDATE peminjaman

        SET
          status = $1

        WHERE
          id = $2
        `,
        [
          status,
          id
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        success: true,

        message:
          status === 'Disetujui'
            ? 'Persetujuan barang berhasil disimpan dan stok telah diperbarui.'
            : `Status berhasil diubah menjadi ${status}.`
      });

    } catch (error) {
      if (client) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch (_) {}
      }


      console.error(
        'Update status gagal:',
        error
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengubah status permintaan.'
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ======================================================
// ADMIN - STATISTIK
// ======================================================

app.get(
  '/api/admin/statistik',
  isAuthenticated,
  async (req, res) => {
    try {
      const result =
        await db.query(
          `
          SELECT

            (
              SELECT
                COUNT(*)

              FROM barang
            )::INTEGER
            AS total_barang,


            (
              SELECT
                COALESCE(
                  SUM(stok),
                  0
                )

              FROM barang
            )::INTEGER
            AS total_stok,


                        (
              SELECT
                COUNT(*)

              FROM peminjaman

              WHERE
                status IN ('Disetujui Katim', 'Pending')
            )::INTEGER
            AS pending,


            (
              SELECT
                COUNT(*)

              FROM peminjaman

              WHERE
                status = 'Disetujui'
            )::INTEGER
            AS disetujui,


            (
              SELECT
                COUNT(*)

              FROM peminjaman

              WHERE
                status IN ('Ditolak', 'Ditolak Katim')
            )::INTEGER
            AS ditolak
          `
        );


      res.json({
        success: true,

        data:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        'Statistik gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil statistik.'
      });
    }
  }
);

// ======================================================
// ADMIN - LAPORAN / SURAT ATK
// ======================================================

app.get(
  '/api/admin/laporan',
  isAuthenticated,
  async (req, res) => {
    try {
      const bidang =
        String(
          req.query.bidang || ''
        ).trim();

      const tanggalMulai =
        String(
          req.query.tanggal_mulai || ''
        ).trim();

      const tanggalSelesai =
        String(
          req.query.tanggal_selesai || ''
        ).trim();

      const jenis =
        String(
          req.query.jenis || 'permintaan'
        ).trim();


      // ------------------------------------------
      // VALIDASI JENIS SURAT
      // ------------------------------------------

      const jenisValid = [
        'permintaan',
        'sbbk'
      ];


      if (
        !jenisValid.includes(jenis)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Jenis laporan tidak valid.'
          });
      }


      // ------------------------------------------
      // VALIDASI BIDANG
      // ------------------------------------------

      const bidangValid = [
        '',
        'Tata Usaha',
        'Pemeriksaan',
        'Penindakan',
        'Infokom'
      ];


      if (
        !bidangValid.includes(bidang)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Bidang tidak valid.'
          });
      }


      // ------------------------------------------
      // VALIDASI TANGGAL
      // ------------------------------------------

      if (
        !tanggalMulai ||
        !tanggalSelesai
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Tanggal mulai dan tanggal selesai wajib diisi.'
          });
      }


      // ------------------------------------------
      // PARAMETER QUERY
      // ------------------------------------------

      const params = [
        tanggalMulai,
        tanggalSelesai
      ];


      let bidangCondition = '';

      if (bidang) {
        params.push(bidang);

        bidangCondition = `
          AND p.bidang = $${params.length}
        `;
      }


      // SBBK hanya mengambil permintaan
      // yang sudah disetujui.
      let statusCondition = '';

      if (
        jenis === 'sbbk'
      ) {
        statusCondition = `
          AND p.status = 'Disetujui'
        `;
      }


      // SBBK hanya mengambil barang yang
      // jumlah_disetujui > 0.
      let itemCondition = '';

      if (
        jenis === 'sbbk'
      ) {
        itemCondition = `
          AND dp.jumlah_disetujui > 0
        `;
      }


      // ------------------------------------------
      // AMBIL DATA
      // ------------------------------------------

      const result =
        await db.query(
          `
          SELECT
            p.id AS peminjaman_id,
            p.nomor_pinjam,
            p.nama_peminjam,
            p.bidang,
            p.keperluan,
            p.status,
            p.tanggal,

            dp.id AS detail_id,
            dp.barang_id,
            dp.jumlah,
            dp.jumlah_disetujui,

            b.kode,
            b.nama AS nama_barang,
            b.satuan

          FROM peminjaman p

          JOIN detail_peminjaman dp
            ON dp.peminjaman_id = p.id

          JOIN barang b
            ON b.id = dp.barang_id

          WHERE
            p.tanggal >= $1::date

            AND p.tanggal <
              (
                $2::date +
                INTERVAL '1 day'
              )

            ${bidangCondition}

            ${statusCondition}

            ${itemCondition}

          ORDER BY
            p.tanggal ASC,

            p.id ASC,

            CASE
              WHEN b.kode ~ '[0-9]+'
                THEN CAST(
                  SUBSTRING(
                    b.kode FROM '[0-9]+'
                  )
                  AS INTEGER
                )
              ELSE 999999
            END ASC,

            b.kode ASC
          `,
          params
        );


      // ------------------------------------------
      // KELOMPOKKAN BERDASARKAN PERMINTAAN
      // ------------------------------------------

      const laporanMap =
        new Map();


      for (
        const row of result.rows
      ) {
        const id =
          Number(
            row.peminjaman_id
          );


        if (
          !laporanMap.has(id)
        ) {
          laporanMap.set(
            id,
            {
              id,

              nomor_pinjam:
                row.nomor_pinjam,

              nama_peminjam:
                row.nama_peminjam,

              bidang:
                row.bidang,

              keperluan:
                row.keperluan || '',

              status:
                row.status,

              tanggal:
                row.tanggal,

              items: []
            }
          );
        }


        laporanMap
          .get(id)
          .items
          .push({
            detail_id:
              row.detail_id,

            barang_id:
              row.barang_id,

            kode:
              row.kode,

            nama:
              row.nama_barang,

            satuan:
              row.satuan,

            jumlah:
              Number(
                row.jumlah
              ) || 0,

            jumlah_disetujui:
              Number(
                row.jumlah_disetujui
              ) || 0
          });
      }


      const data =
        Array.from(
          laporanMap.values()
        );


      // ------------------------------------------
      // RESPONSE
      // ------------------------------------------

      res.json({
        success: true,

        filter: {
          jenis,
          bidang:
            bidang || 'Semua Bidang',

          tanggal_mulai:
            tanggalMulai,

          tanggal_selesai:
            tanggalSelesai
        },

        total_permintaan:
          data.length,

        total_item:
          result.rows.length,

        data
      });

    } catch (error) {
      console.error(
        'Laporan ATK gagal:',
        error
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil data laporan ATK.'
      });
    }
  }
);
// ======================================================
// API 404
// ======================================================

app.use(
  '/api',
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        'Endpoint API tidak ditemukan.'
    });
  }
);


// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      'Server error:',
      error.message
    );


    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        'LIMIT_FILE_SIZE'
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Ukuran file CSV maksimal 2 MB.'
          });
      }
    }


    res.status(500).json({
      success: false,

      error:
        error.message ||
        'Terjadi kesalahan pada server.'
    });
  }
);


// ======================================================
// LOCAL SERVER
// ======================================================

if (
  require.main === module
) {
  app.listen(
    PORT,
    '0.0.0.0',
    async () => {
      console.log(
        `✅ Server berjalan di http://localhost:${PORT}`
      );

      console.log(
        `📄 Form ATK: http://localhost:${PORT}`
      );

      console.log(
        `🔧 Admin: http://localhost:${PORT}/admin`
      );



      await db.testConnection();
    }
  );
}


// ======================================================
// VERCEL
// ======================================================

module.exports = app;