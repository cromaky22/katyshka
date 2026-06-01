const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const dbFile = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbFile);

app.use(express.json());
app.use(express.static(__dirname));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    avatar TEXT,
    updated_at TEXT
  )`);
});

app.post('/api/users', (req, res) => {
  const u = req.body || {};
  if (!u.id) return res.status(400).json({ error: 'missing id' });
  const stmt = db.prepare(`REPLACE INTO users (id, first_name, last_name, username, avatar, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))`);
  stmt.run(u.id, u.first_name || null, u.last_name || null, u.username || null, u.avatar || null, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
  stmt.finalize();
});

app.get('/api/users/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({});
    res.json(row);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
