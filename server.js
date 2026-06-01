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
