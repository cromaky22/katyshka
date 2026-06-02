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
    balance REAL DEFAULT 100,
    updated_at TEXT
  )`);
  // ensure balance column exists for older DBs
  db.get("PRAGMA table_info(users)", [], (err, info) => {
    // we will perform a safe check for balance column
    db.all("PRAGMA table_info(users)", [], (err2, cols) => {
      if(!err2 && Array.isArray(cols)){
        const has = cols.some(c=> c.name === 'balance');
        if(!has){
          db.run('ALTER TABLE users ADD COLUMN balance REAL DEFAULT 100');
        }
      }
    });
  });
  db.run(`CREATE TABLE IF NOT EXISTS promos (
    code TEXT PRIMARY KEY,
    amount REAL DEFAULT 0,
    uses INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS promo_activations (
    id INTEGER PRIMARY KEY,
    code TEXT,
    user_id TEXT,
    activated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(code, user_id)
  )`);
  
  // Load promos from promos.json into database
  try {
    const promosFile = path.join(__dirname, 'promos.json');
    const promosData = require(promosFile);
    if (Array.isArray(promosData)) {
      promosData.forEach(promo => {
        const code = (promo.code || '').toUpperCase();
        if (code) {
          db.run(`INSERT OR IGNORE INTO promos (code, amount, uses, max_uses, created_at) 
                  VALUES (?, ?, ?, ?, datetime('now'))`,
            [code, Number(promo.amount) || 0, Number(promo.uses) || 0, Number(promo.maxUses) || 0],
            (err) => {
              if (err) console.error('Error loading promo:', code, err);
            });
        }
      });
    }
  } catch (e) {
    console.error('Error loading promos.json:', e);
  }
});

// Promo endpoints
app.get('/api/promos', (req, res) => {
  db.all('SELECT code, amount, uses, max_uses AS maxUses, created_at FROM promos ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/promos', (req, res) => {
  const body = req.body || {};
  const code = (body.code || '').toString().trim().toUpperCase();
  const amount = Number(body.amount) || 0;
  const maxUses = Number(body.maxUses) || 0;
  if (!code) return res.status(400).json({ error: 'missing code' });
  const stmt = db.prepare(`INSERT OR REPLACE INTO promos (code, amount, uses, max_uses, created_at) VALUES (?, ?, COALESCE((SELECT uses FROM promos WHERE code = ?), 0), ?, datetime('now'))`);
  stmt.run(code, amount, code, maxUses, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
  stmt.finalize();
});

app.delete('/api/promos/:code', (req, res) => {
  const code = (req.params.code || '').toString().trim().toUpperCase();
  if(!code) return res.status(400).json({ error: 'missing code' });
  db.run('DELETE FROM promos WHERE code = ?', [code], function(err){
    if(err) return res.status(500).json({ error: err.message });
    // also remove activations
    db.run('DELETE FROM promo_activations WHERE code = ?', [code], ()=>{});
    res.json({ ok: true });
  });
});

app.post('/api/promos/:code/activate', (req, res) => {
  const code = (req.params.code || '').toString().trim().toUpperCase();
  const userId = (req.body && req.body.userId) ? req.body.userId.toString() : null;
  if(!code) return res.status(400).json({ error: 'missing code' });
  if(!userId) return res.status(400).json({ error: 'missing userId' });
  db.get('SELECT code, amount, uses, max_uses AS maxUses FROM promos WHERE code = ?', [code], (err, promo) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!promo) return res.status(404).json({ error: 'promo not found' });
    const max = Number(promo.maxUses || 0);
    const used = Number(promo.uses || 0);
    if (max > 0 && used >= max) return res.status(400).json({ error: 'max uses reached' });
    // check user activation
    db.get('SELECT 1 FROM promo_activations WHERE code = ? AND user_id = ?', [code, userId], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (row) return res.status(400).json({ error: 'already activated' });
      // insert activation and increment uses
      const ins = db.prepare('INSERT INTO promo_activations (code, user_id) VALUES (?, ?)');
      ins.run(code, userId, function(err3){
        if(err3) return res.status(500).json({ error: err3.message });
        db.run('UPDATE promos SET uses = COALESCE(uses,0) + 1 WHERE code = ?', [code], function(err4){
          if(err4) return res.status(500).json({ error: err4.message });
          res.json({ ok: true, amount: promo.amount });
        });
      });
      ins.finalize();
    });
  });
});

app.post('/api/users', (req, res) => {
  const u = req.body || {};
  if (!u.id) return res.status(400).json({ error: 'missing id' });
  // preserve existing balance unless explicitly provided
  db.get('SELECT balance FROM users WHERE id = ?', [u.id], (err, row) => {
    if(err) return res.status(500).json({ error: err.message });
    const existingBalance = (row && row.balance != null) ? row.balance : 100;
    const balance = (u.balance != null) ? Number(u.balance) : existingBalance;
    const stmt = db.prepare(`INSERT OR REPLACE INTO users (id, first_name, last_name, username, avatar, balance, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`);
    stmt.run(u.id, u.first_name || null, u.last_name || null, u.username || null, u.avatar || null, balance, function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true });
    });
    stmt.finalize();
  });
});

app.get('/api/users/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({});
    res.json(row);
  });
});

// list users
app.get('/api/users', (req, res) => {
  db.all('SELECT id, first_name, last_name, username, avatar, balance, updated_at FROM users ORDER BY updated_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// update user balance
app.put('/api/users/:id/balance', (req, res) => {
  const id = req.params.id;
  const b = Number((req.body && req.body.balance) || 0);
  if (!id) return res.status(400).json({ error: 'missing id' });
  if (isNaN(b)) return res.status(400).json({ error: 'invalid balance' });
  db.run('UPDATE users SET balance = ?, updated_at = datetime(\'now\') WHERE id = ?', [b, id], function(err){
    if(err) return res.status(500).json({ error: err.message });
    // if no rows updated, create new user row with balance
    if(this.changes === 0){
      const stmt = db.prepare('INSERT INTO users (id, balance, updated_at) VALUES (?, ?, datetime(\'now\'))');
      stmt.run(id, b, function(err2){ if(err2) return res.status(500).json({ error: err2.message }); res.json({ ok: true }); });
      stmt.finalize();
      return;
    }
    res.json({ ok: true });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

// Endpoint to proxy Telegram user profile photo via bot token
const https = require('https');
app.get('/api/tg-photo/:id', (req, res) => {
  const botToken = process.env.BOT_TOKEN;
  if(!botToken) return res.status(404).send('Bot token not configured');
  const userId = req.params.id;
  // getUserProfilePhotos
  const getPhotosUrl = `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`;
  https.get(getPhotosUrl, (r) => {
    let body = '';
    r.on('data', c=> body += c);
    r.on('end', ()=>{
      try{
        const j = JSON.parse(body);
        if(!j.ok || !j.result || !j.result.total_count) return res.status(404).send('No photo');
        const fileId = j.result.photos[0][0].file_id;
        const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
        https.get(getFileUrl, (rf)=>{
          let b2 = '';
          rf.on('data', c=> b2 += c);
          rf.on('end', ()=>{
            try{
              const j2 = JSON.parse(b2);
              if(!j2.ok || !j2.result || !j2.result.file_path) return res.status(404).send('No file');
              const filePath = j2.result.file_path;
              const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
              // stream file
              https.get(fileUrl, (fres)=>{
                res.setHeader('Content-Type', fres.headers['content-type'] || 'image/jpeg');
                fres.pipe(res);
              }).on('error', ()=> res.status(500).end());
            }catch(e){ res.status(500).end(); }
          });
        }).on('error', ()=> res.status(500).end());
      }catch(e){ res.status(500).end(); }
    });
  }).on('error', ()=> res.status(500).end());
});
