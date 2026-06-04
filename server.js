const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });

// Database: PostgreSQL for Railway (or SQLite for local)
const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
  // Railway: use PostgreSQL
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Initialize tables
  pool.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    avatar TEXT,
    balance REAL DEFAULT 100,
    updated_at TEXT
  )`).then(() => {
    console.log('PostgreSQL connected');
  });

  // Wrapper to use pg queries
  const db = {
    get: (sql, params, cb) => {
      pool.query(sql, params).then(r => cb(null, r.rows[0] || null)).catch(e => cb(e));
    },
    all: (sql, params, cb) => {
      pool.query(sql, params).then(r => cb(null, r.rows || [])).catch(e => cb(e));
    },
    run: (sql, params, cb) => {
      pool.query(sql, params).then(r => {
        if (cb) cb(null, { changes: r.rowCount });
      }).catch(e => {
        if (cb) cb(e);
      });
    }
  };

  module.exports = { pool, db };
} else {
  // Local: use SQLite
  const sqlite3 = require('sqlite3').verbose();
  const dbFile = path.join(__dirname, 'data.sqlite');
  const db = new sqlite3.Database(dbFile);

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      avatar TEXT,
      balance REAL DEFAULT 100,
      updated_at TEXT
    )`);
    console.log('SQLite connected');
  });

  module.exports = { db };
}

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

// === XROCKET PAYMENTS ===
const XROCKET_API_KEY = 'f391f7a440adb0cfb0f7a1afe';
const XROCKET_API = 'https://pay.xrocket.tg/api';

async function xrocketRequest(method, body){
  const res = await fetch(`${XROCKET_API}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': XROCKET_API_KEY
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

// Create xRocket deposit invoice
app.post('/api/deposit/xrocket', async (req, res) => {
  const { userId, amount } = req.body || {};
  if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'missing userId or amount' });

  try {
    const result = await xrocketRequest('invoice', {
      amount: Number(amount).toFixed(2),
      currency: 'TONCOIN',
      description: `Пополнение баланса ${userId}`,
      payload: JSON.stringify({ userId, type: 'deposit_xr' }),
      expiredIn: 1800
    });

    if (result.ok || result.data) {
      const invoice = result.data || result.result;
      res.json({
        ok: true,
        invoiceId: invoice.id || invoice.invoiceId,
        payUrl: invoice.payUrl || invoice.bot_invoice_url,
        amount: Number(amount).toFixed(2)
      });
    } else {
      res.status(500).json({ error: result.error || result.message || 'xrocket error' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Check xRocket invoice status
app.post('/api/deposit/xrocket/check', async (req, res) => {
  const { invoiceId } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'missing invoiceId' });

  try {
    const result = await xrocketRequest(`invoice/${invoiceId}`);
    if (result.ok || result.data) {
      const invoice = result.data || result.result;
      res.json({ ok: true, status: invoice.status, invoice });
    } else {
      res.json({ ok: true, status: 'not_found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// xRocket webhook
app.post('/api/xrocket-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const body = JSON.parse(req.body.toString());
  if (body.type === 'invoice_paid' || body.status === 'paid') {
    const payload = JSON.parse(body.payload || '{}');
    if ((payload.type === 'deposit_xr' || payload.type === 'deposit') && payload.userId) {
      const amount = parseFloat(body.amount || body.result?.amount || 0);
      if (amount > 0) {
        db.run('UPDATE users SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?', [amount, payload.userId], function() {
          if (this.changes === 0) {
            db.run('INSERT INTO users (id, balance, updated_at) VALUES (?, ?, datetime(\'now\'))', [payload.userId, amount]);
          }
        });
        io.emit('balance_update', { userId: payload.userId, amount });
      }
    }
  }
  res.json({ ok: true });
});

// Withdraw via xRocket
app.post('/api/withdraw/xrocket', async (req, res) => {
  const { userId, amount, wallet } = req.body || {};
  if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'missing userId or amount' });

  const amt = Math.round(Number(amount) * 100) / 100;
  const fee = Math.round(amt * 0.03 * 100) / 100;
  const total = amt + fee;

  db.get('SELECT balance FROM users WHERE id = ?', [userId], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'user not found' });
    if (row.balance < total) return res.status(400).json({ error: 'insufficient balance' });

    try {
      const result = await xrocketRequest('cheque', {
        amount: amt.toFixed(2),
        currency: 'TONCOIN',
        description: `Вывод ${userId}`,
        usersNumber: 1,
        chequePerUser: amt.toFixed(2)
      });

      if (result.ok || result.data) {
        db.run('UPDATE users SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ?', [total, userId]);
        db.get('SELECT balance FROM users WHERE id = ?', [userId], (_, row2) => {
          res.json({ ok: true, received: amt, fee, balance: row2 ? row2.balance : row.balance - total });
        });
      } else {
        res.status(500).json({ error: result.error || result.message || 'xrocket withdraw failed' });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// === CRYPTOBOT PAYMENTS ===
const CRYPTOBOT_TOKEN = '411440:AAWUSDQWHE8fLkRQN20YRJi0DBb2skCPOdJ';
const CRYPTOBOT_API = 'https://pay.crypt.bot/api';

async function cryptobotRequest(method, body){
  const res = await fetch(`${CRYPTOBOT_API}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Crypto-Pay-API-Token': CRYPTOBOT_TOKEN
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

// Create deposit invoice
app.post('/api/deposit', async (req, res) => {
  const { userId, amount } = req.body || {};
  if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'missing userId or amount' });

  try {
    const result = await cryptobotRequest('createInvoice', {
      asset: 'USDT',
      amount: Number(amount).toFixed(2),
      description: `Пополнение баланса для пользователя ${userId}`,
      payload: JSON.stringify({ userId, type: 'deposit' }),
      expires_in: 1800 // 30 min
    });

    if (result.ok) {
      res.json({
        ok: true,
        invoiceId: result.result.invoice_id,
        payUrl: result.result.bot_invoice_url,
        amount: Number(amount).toFixed(2)
      });
    } else {
      res.status(500).json({ error: result.error || 'cryptobot error' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Check deposit status
app.post('/api/deposit/check', async (req, res) => {
  const { invoiceId } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'missing invoiceId' });

  try {
    const result = await cryptobotRequest('getInvoices', { invoice_ids: String(invoiceId) });
    if (result.ok && result.result.items.length > 0) {
      const invoice = result.result.items[0];
      res.json({ ok: true, status: invoice.status, invoice });
    } else {
      res.json({ ok: true, status: 'not_found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook for cryptobot payments
app.post('/api/cryptobot-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const body = JSON.parse(req.body.toString());
  if (body.update_type === 'invoice_paid') {
    const payload = JSON.parse(body.payload.payload || '{}');
    if (payload.type === 'deposit' && payload.userId) {
      const amount = parseFloat(body.payload.amount);
      db.run('UPDATE users SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?', [amount, payload.userId], function() {
        if (this.changes === 0) {
          db.run('INSERT INTO users (id, balance, updated_at) VALUES (?, ?, datetime(\'now\'))', [payload.userId, amount]);
        }
      });
      // Notify via socket.io
      io.emit('balance_update', { userId: payload.userId, amount });
    }
    res.json({ ok: true });
  } else {
    res.json({ ok: true });
  }
});

// Withdraw via cryptobot transfer
app.post('/api/withdraw', async (req, res) => {
  const { userId, amount, wallet } = req.body || {};
  if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'missing userId or amount' });

  const amt = Math.round(Number(amount) * 100) / 100;
  const fee = Math.round(amt * 0.03 * 100) / 100;
  const total = amt + fee;

  db.get('SELECT balance FROM users WHERE id = ?', [userId], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'user not found' });
    if (row.balance < total) return res.status(400).json({ error: 'insufficient balance' });

    try {
      // Use cryptobot transfer
      const spendId = 'wd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const result = await cryptobotRequest('transfer', {
        user_id: parseInt(userId) || 0,
        asset: 'USDT',
        amount: amt.toFixed(2),
        spend_id: spendId,
        comment: `Вывод средств с Katyshka`
      });

      if (result.ok) {
        db.run('UPDATE users SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ?', [total, userId], function() {
          db.get('SELECT balance FROM users WHERE id = ?', [userId], (_, row2) => {
            res.json({ ok: true, received: amt, fee, balance: row2 ? row2.balance : row.balance - total });
          });
        });
      } else {
        res.status(500).json({ error: result.error || 'transfer failed' });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// === WHEEL GAME STATE ===
const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
function getWheelColor(n) { return n === 0 ? 'green' : (RED_NUMBERS.indexOf(n) !== -1 ? 'red' : 'black'); }
function betWins(betType, resultNum) {
  if (betType === '0') return resultNum === 0;
  if (betType === 'red') return RED_NUMBERS.indexOf(resultNum) !== -1;
  if (betType === 'black') return resultNum > 0 && RED_NUMBERS.indexOf(resultNum) === -1;
  if (betType === 'odd') return resultNum > 0 && resultNum % 2 === 0;
  if (betType === 'notodd') return resultNum > 0 && resultNum % 2 === 1;
  if (betType === 'range1') return resultNum >= 1 && resultNum <= 18;
  if (betType === 'range2') return resultNum >= 19 && resultNum <= 36;
  if (betType === 'range3') return resultNum >= 1 && resultNum <= 12;
  if (betType === 'range4') return resultNum >= 13 && resultNum <= 24;
  if (betType === 'range5') return resultNum >= 25 && resultNum <= 36;
  if (!isNaN(Number(betType))) return resultNum === Number(betType);
  return false;
}
function getBetCoef(type) {
  if (type === '0' || !isNaN(Number(type))) return 36;
  if (type === 'range3' || type === 'range4' || type === 'range5') return 3;
  return 2;
}

let wheelState = { phase: 'betting', timer: 20, roundId: 0, result: null, allBets: {}, history: [] };
let wheelTimerInterval = null;

function startWheelTimer() {
  if (wheelTimerInterval) clearInterval(wheelTimerInterval);
  wheelState.timer = 20;
  wheelState.phase = 'betting';
  io.emit('wheel:timer', { timer: 20, phase: 'betting' });
  wheelTimerInterval = setInterval(() => {
    wheelState.timer--;
    io.emit('wheel:timer', { timer: wheelState.timer, phase: wheelState.phase });
    if (wheelState.timer <= 0) { clearInterval(wheelTimerInterval); spinWheel(); }
  }, 1000);
}

function spinWheel() {
  wheelState.phase = 'spinning';
  const targetIdx = Math.floor(Math.random() * WHEEL_NUMBERS.length);
  const resultNum = WHEEL_NUMBERS[targetIdx];
  const resultColor = getWheelColor(resultNum);
  const allBetsList = [];
  for (const uid in wheelState.allBets) {
    wheelState.allBets[uid].forEach(bet => {
      allBetsList.push({ userId: uid, type: bet.type, amount: bet.amount, playerName: bet.playerName || 'Player', playerAvatar: bet.playerAvatar || '' });
    });
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
