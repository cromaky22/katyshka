const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });

const dbFile = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbFile);

const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

app.use(express.json());
app.use(express.static(__dirname));

// middleware для проверки админ-ключа
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.adminKey || '';
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

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

app.post('/api/promos', requireAdmin, (req, res) => {
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

app.delete('/api/promos/:code', requireAdmin, (req, res) => {
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

// list users (admin only)
app.get('/api/users', requireAdmin, (req, res) => {
  db.all('SELECT id, first_name, last_name, username, avatar, balance, updated_at FROM users ORDER BY updated_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// update user balance (admin only)
app.put('/api/users/:id/balance', requireAdmin, (req, res) => {
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

// === WHEEL GAME STATE ===
  }
  const results = {};
  for (const uid in wheelState.allBets) {
    let totalWin = 0;
    wheelState.allBets[uid].forEach(bet => { if (betWins(bet.type, resultNum)) totalWin += bet.amount * getBetCoef(bet.type); });
    totalWin = Math.round(totalWin * 100) / 100;
    results[uid] = totalWin;
    if (totalWin > 0) db.run('UPDATE users SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?', [totalWin, uid]);
  }
  wheelState.result = { num: resultNum, color: resultColor, index: targetIdx };
  wheelState.history.unshift({ num: resultNum, color: resultColor });
  if (wheelState.history.length > 20) wheelState.history.pop();
  io.emit('wheel:spin', { result: wheelState.result, allBets: allBetsList, results: results, history: wheelState.history });
  setTimeout(() => {
    wheelState.allBets = {};
    wheelState.result = null;
    wheelState.roundId++;
    startWheelTimer();
    io.emit('wheel:newRound', { roundId: wheelState.roundId, history: wheelState.history });
  }, 7000);
}

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || '0';
  socket.emit('wheel:state', { phase: wheelState.phase, timer: wheelState.timer, roundId: wheelState.roundId, result: wheelState.result, history: wheelState.history, myBets: wheelState.allBets[userId] || [] });
  socket.on('wheel:bet', (data) => {
    if (wheelState.phase !== 'betting') return;
    const { type, amount, playerName, playerAvatar } = data;
    if (!type || !amount || amount <= 0) return;
    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
      if (err || !row) return;
      const balance = row.balance;
      const currentBetTotal = (wheelState.allBets[userId] || []).reduce((s, b) => s + b.amount, 0);
      if (currentBetTotal + amount > balance) return;
      if (!wheelState.allBets[userId]) wheelState.allBets[userId] = [];
      wheelState.allBets[userId].push({ type, amount, playerName: playerName || 'Player', playerAvatar: playerAvatar || '' });
      db.run('UPDATE users SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ?', [amount, userId]);
      const allBetsList = [];
      for (const uid in wheelState.allBets) {
        wheelState.allBets[uid].forEach(bet => { allBetsList.push({ userId: uid, type: bet.type, amount: bet.amount, playerName: bet.playerName, playerAvatar: bet.playerAvatar }); });
      }
      io.emit('wheel:betsUpdate', { allBets: allBetsList, myBets: wheelState.allBets[userId] || [] });
    });
  });
});

startWheelTimer();

// === DICE GAME STATE ===
const DICE_CONFIGS = {
  '1dice': {
    bets: {
      'odd': { coef: 1.9, check: (nums) => nums.reduce((a,b) => a+b, 0) % 2 === 0 },
      'notodd': { coef: 1.9, check: (nums) => nums.reduce((a,b) => a+b, 0) % 2 !== 0 },
      '1': { coef: 5, check: (nums) => nums[0] === 1 },
      '2': { coef: 5, check: (nums) => nums[0] === 2 },
      '3': { coef: 5, check: (nums) => nums[0] === 3 },
      '4': { coef: 5, check: (nums) => nums[0] === 4 },
      '5': { coef: 5, check: (nums) => nums[0] === 5 },
      '6': { coef: 5, check: (nums) => nums[0] === 6 }
    },
    diceCount: 1
  },
  '2dice': {
    bets: {
      'odd': { coef: 1.75, check: (nums) => nums.reduce((a,b) => a+b, 0) % 2 === 0 },
      'notodd': { coef: 2.1, check: (nums) => nums.reduce((a,b) => a+b, 0) % 2 !== 0 },
      '2': { coef: 34, check: (nums) => nums.reduce((a,b) => a+b, 0) === 2 },
      '3': { coef: 17, check: (nums) => nums.reduce((a,b) => a+b, 0) === 3 },
      '4': { coef: 11, check: (nums) => nums.reduce((a,b) => a+b, 0) === 4 },
      '5': { coef: 8, check: (nums) => nums.reduce((a,b) => a+b, 0) === 5 },
      '6': { coef: 6, check: (nums) => nums.reduce((a,b) => a+b, 0) === 6 },
      '7': { coef: 6, check: (nums) => nums.reduce((a,b) => a+b, 0) === 7 },
      '8': { coef: 6, check: (nums) => nums.reduce((a,b) => a+b, 0) === 8 },
      '9': { coef: 8, check: (nums) => nums.reduce((a,b) => a+b, 0) === 9 },
      '10': { coef: 11, check: (nums) => nums.reduce((a,b) => a+b, 0) === 10 },
      '11': { coef: 17, check: (nums) => nums.reduce((a,b) => a+b, 0) === 11 },
      '12': { coef: 34, check: (nums) => nums.reduce((a,b) => a+b, 0) === 12 }
    },
    diceCount: 2
  },
  '3dice': {
    bets: {
      'odd': { coef: 1.5, check: (nums) => nums.reduce((a,b) => a+b, 0) % 2 === 0 },
      'notodd': { coef: 2.5, check: (nums) => nums.reduce((a,b) => a+b, 0) % 2 !== 0 },
      '3': { coef: 216, check: (nums) => nums.reduce((a,b) => a+b, 0) === 3 },
      '4': { coef: 72, check: (nums) => nums.reduce((a,b) => a+b, 0) === 4 },
      '5': { coef: 36, check: (nums) => nums.reduce((a,b) => a+b, 0) === 5 },
      '6': { coef: 21, check: (nums) => nums.reduce((a,b) => a+b, 0) === 6 },
      '7': { coef: 14, check: (nums) => nums.reduce((a,b) => a+b, 0) === 7 },
      '8': { coef: 10, check: (nums) => nums.reduce((a,b) => a+b, 0) === 8 },
      '9': { coef: 8, check: (nums) => nums.reduce((a,b) => a+b, 0) === 9 },
      '10': { coef: 7, check: (nums) => nums.reduce((a,b) => a+b, 0) === 10 },
      '11': { coef: 7, check: (nums) => nums.reduce((a,b) => a+b, 0) === 11 },
      '12': { coef: 8, check: (nums) => nums.reduce((a,b) => a+b, 0) === 12 },
      '13': { coef: 10, check: (nums) => nums.reduce((a,b) => a+b, 0) === 13 },
      '14': { coef: 14, check: (nums) => nums.reduce((a,b) => a+b, 0) === 14 },
      '15': { coef: 21, check: (nums) => nums.reduce((a,b) => a+b, 0) === 15 },
      '16': { coef: 36, check: (nums) => nums.reduce((a,b) => a+b, 0) === 16 },
      '17': { coef: 72, check: (nums) => nums.reduce((a,b) => a+b, 0) === 17 },
      '18': { coef: 216, check: (nums) => nums.reduce((a,b) => a+b, 0) === 18 }
    },
    diceCount: 3
  }
};

let diceStates = {
  '1dice': { phase: 'waiting', timer: 30, roundId: 0, nums: null, allBets: {}, history: [], hash: '' },
  '2dice': { phase: 'waiting', timer: 30, roundId: 0, nums: null, allBets: {}, history: [], hash: '' },
  '3dice': { phase: 'waiting', timer: 30, roundId: 0, nums: null, allBets: {}, history: [], hash: '' }
};

let diceTimerIntervals = {};

function generateHash() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function startDiceTimer(diceType) {
  if (diceTimerIntervals[diceType]) clearInterval(diceTimerIntervals[diceType]);
  const state = diceStates[diceType];
  state.timer = 30;
  state.phase = 'betting';
  state.hash = generateHash();
  console.log(`[DICE] Starting timer for ${diceType}, hash: ${state.hash}`);
  io.emit(`dice:${diceType}:timer`, { timer: 30, phase: 'betting' });
  
  diceTimerIntervals[diceType] = setInterval(() => {
    state.timer--;
    console.log(`[DICE] ${diceType} timer: ${state.timer}`);
    io.emit(`dice:${diceType}:timer`, { timer: state.timer, phase: state.phase });
    if (state.timer <= 0) {
      clearInterval(diceTimerIntervals[diceType]);
      console.log(`[DICE] ${diceType} timer ended, rolling...`);
      rollDice(diceType);
    }
  }, 1000);
}

function rollDice(diceType) {
  const state = diceStates[diceType];
  const config = DICE_CONFIGS[diceType];
  state.phase = 'rolling';
  
  const nums = [];
  for (let i = 0; i < config.diceCount; i++) {
    nums.push(Math.floor(Math.random() * 6) + 1);
  }
  
  const results = {};
  for (const uid in state.allBets) {
    let totalWin = 0;
    let totalBet = 0;
    state.allBets[uid].forEach(bet => {
      totalBet += bet.amount;
      const betConfig = config.bets[bet.type];
      if (betConfig && betConfig.check(nums)) {
        totalWin += bet.amount * betConfig.coef;
      }
    });
    totalWin = Math.round(totalWin * 100) / 100;
    results[uid] = { win: totalWin, bet: totalBet };
    if (totalWin > 0) {
      db.run('UPDATE users SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?', [totalWin, uid]);
    }
    const net = totalWin - totalBet;
    const sign = net > 0 ? '+' : net < 0 ? '-' : '';
    results[uid].net = { num: Math.abs(net), str: sign };
  }
  
  state.nums = nums;
  state.hash = `${generateHash()}|${nums.join(',')}|${generateHash()}`;
  
  const allBetsList = [];
  for (const uid in state.allBets) {
    state.allBets[uid].forEach(bet => {
      allBetsList.push({ userId: uid, type: bet.type, amount: bet.amount, playerName: bet.playerName || 'Player', playerAvatar: bet.playerAvatar || '' });
    });
  }
  
  const sum = nums.reduce((a, b) => a + b, 0);
  state.history.unshift({ nums: nums, sum: sum });
  if (state.history.length > 20) state.history.pop();
  
  io.emit(`dice:${diceType}:roll`, {
    result: { nums: nums, sum: sum },
    allBets: allBetsList,
    results: results,
    hash: state.hash,
    history: state.history
  });
  
  setTimeout(() => {
    state.allBets = {};
    state.nums = null;
    state.roundId++;
    state.phase = 'waiting';
    state.timer = 30;
    io.emit(`dice:${diceType}:newRound`, { roundId: state.roundId, history: state.history });
  }, 7000);
}

Object.keys(diceStates).forEach(type => {
  const state = diceStates[type];
  state.phase = 'waiting';
  state.timer = 30;
});

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || '0';
  
  // Send dice states
  Object.keys(diceStates).forEach(type => {
    const state = diceStates[type];
    socket.emit(`dice:${type}:state`, {
      phase: state.phase,
      timer: state.timer,
      roundId: state.roundId,
      nums: state.nums,
      history: state.history,
      myBets: state.allBets[userId] || []
    });
  });
  
  socket.on('dice:bet', (data) => {
    const { type, amount, diceType, playerName, playerAvatar } = data;
    if (!DICE_CONFIGS[diceType]) return;
    const state = diceStates[diceType];
    if (state.phase !== 'betting' && state.phase !== 'waiting') return;
    if (!type || !amount || amount <= 0) return;
    
    const config = DICE_CONFIGS[diceType];
    if (!config.bets[type]) return;
    
    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
      if (err || !row) return;
      const balance = row.balance;
      const currentBetTotal = (state.allBets[userId] || []).reduce((s, b) => s + b.amount, 0);
      if (currentBetTotal + amount > balance) return;
      
      const wasWaiting = state.phase === 'waiting';
      
      if (!state.allBets[userId]) state.allBets[userId] = [];
      state.allBets[userId].push({
        type,
        amount,
        playerName: playerName || 'Player',
        playerAvatar: playerAvatar || ''
      });
      
      db.run('UPDATE users SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ?', [amount, userId]);
      
      if (wasWaiting) {
        startDiceTimer(diceType);
      }
      
      const allBetsList = [];
      for (const uid in state.allBets) {
        state.allBets[uid].forEach(bet => {
          allBetsList.push({ userId: uid, type: bet.type, amount: bet.amount, playerName: bet.playerName, playerAvatar: bet.playerAvatar });
        });
      }
      io.emit(`dice:${diceType}:betsUpdate`, { allBets: allBetsList, myBets: state.allBets[userId] || [] });
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

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
