require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');  // ganti mysql2 dengan pg
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// koneksi PostgreSQL
const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false } // biasanya Supabase perlu SSL
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { nim, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE nim = $1', [nim]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'NIM tidak ditemukan' });

    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ message: 'Password salah' });
    }
    // tambahkan `is_admin` ke dalam token klo udh ad di database
    const tokenPayload = { 
        user_id: user.id, 
        nim: user.nim,
        is_admin: user.is_admin || false // anggap `is_admin` ad di tabel users
    };
    
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, is_admin: user.is_admin || false }); // kirim status admin ke frontend
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware auth
function auth(req, res, next) {
  const bearer = req.headers.authorization;
  if (!bearer) return res.status(401).json({ message: 'Token hilang' });
  const token = bearer.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid' });
  }
}

// middleware utk admin
function adminOnly(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ message: 'Akses ditolak: hanya untuk admin' });
    }
    next();
}

// Get candidates
app.get('/api/candidates', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT id, nama, foto_url, visi FROM candidates');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Vote
app.post('/api/vote', auth, async (req, res) => {
  const user_id = req.user.user_id;
  const { candidate_id } = req.body;
  try {
    const u = await db.query('SELECT has_voted FROM users WHERE id = $1', [user_id]);
    if (!u.rows.length) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (u.rows[0].has_voted) return res.status(400).json({ message: 'Sudah memilih' });

    await db.query('INSERT INTO votes (user_id, candidate_id) VALUES ($1, $2)', [user_id, candidate_id]);
    await db.query('UPDATE users SET has_voted = true WHERE id = $1', [user_id]);
    res.json({ message: 'Voting sukses' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Result untuk admin
app.get('/api/admin/results', auth, adminOnly, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.nama, COUNT(v.id) AS total_suara
      FROM candidates c
      LEFT JOIN votes v ON v.candidate_id = c.id
      GROUP BY c.id
      ORDER BY total_suara DESC
    `);
    
    const voteCounts = result.rows;
    const totalVotes = voteCounts.reduce((sum, current) => sum + parseInt(current.total_suara, 10), 0);
    
    const resultsWithPercentage = voteCounts.map(c => ({
        ...c,
        percentage: totalVotes > 0 ? ((c.total_suara / totalVotes) * 100).toFixed(2) : 0
    }));

    res.json(resultsWithPercentage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
