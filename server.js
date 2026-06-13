const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(__dirname));

// === GET USER BALANCE ===
app.get('/api/users', async (req, res) => {
  const id = req.query.id;
  if (id) {
    const dbUser = await dbGetUser(id);
    if (dbUser) return res.json({ ok: true, balance: dbUser.balance, ...dbUser });
    return res.json({ ok: true, balance: getBalance(id) });
  }
  const userList = await dbGetAllUsers();
  res.json(userList);
});

// === ADD TRANSACTION (client-called) ===
app.post('/api/transaction', async (req, res) => {
  const { userId, type, amount, detail } = req.body;
  console.log('📥 Transaction:', { userId, type, amount, detail });
  if (!userId || !type || !amount) return res.status(400).json({ error: 'Missing params' });
  await addTx(type, userId, Math.abs(amount), 'completed', { game: detail });
  console.log('✅ Saved to DB:', usePostgres);
  res.json({ ok: true });
});

// === GET USER STATS ===
app.get('/api/stats', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  
  // Get transactions from DB or memory
  const userTx = await dbGetUserTx(userId);
  
  let deposits = 0, withdraws = 0, totalWin = 0, maxWin = 0, totalBets = 0;
  let wins = 0, losses = 0;
  const history = [];
  
  userTx.forEach(t => {
    if (t.type === 'deposit') { deposits += t.amount; history.push({ type: 'deposit', amount: t.amount, time: t.time, title: 'Пополнение' }); }
    if (t.type === 'withdraw') { withdraws += Math.abs(t.amount); history.push({ type: 'withdraw', amount: Math.abs(t.amount), time: t.time, title: 'Вывод' }); }
    if (t.type === 'bet') { totalBets += Math.abs(t.amount); history.push({ type: 'bet', amount: Math.abs(t.amount), time: t.time, game: t.game, detail: t.detail }); }
    if (t.type === 'win') { wins++; totalWin += t.amount; if (t.amount > maxWin) maxWin = t.amount; history.push({ type: 'win', amount: t.amount, time: t.time, game: t.game, detail: t.detail }); }
    if (t.type === 'loss') { losses++; history.push({ type: 'loss', amount: Math.abs(t.amount), time: t.time, game: t.game, detail: t.detail }); }
    if (t.type === 'promo') { deposits += t.amount; history.push({ type: 'promo', amount: t.amount, time: t.time, title: 'Промокод' }); }
  });
  
  const games = Math.max(wins + losses);
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;
  
  res.json({ deposits, withdraws, totalWin, maxWin, totalBets, games, wins, losses, winRate, history });
});

app.post('/api/users', async (req, res) => {
  const { id, balance, first_name, last_name, username, avatar } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  if (!users[id]) users[id] = { balance: 0 };
  if (balance !== undefined) {
    users[id].balance = Math.round(parseFloat(balance) * 100) / 100;
  }
  if (first_name !== undefined) users[id].first_name = first_name;
  if (last_name !== undefined) users[id].last_name = last_name;
  if (username !== undefined) users[id].username = username;
  if (avatar !== undefined) users[id].avatar = avatar;
  
  // Save to DB
  await dbSetUser(id, users[id]);
  res.json({ ok: true, balance: users[id].balance });
});

// === ADMIN: UPDATE BALANCE (give/take) ===
app.post('/api/admin/balance', async (req, res) => {
  const { secret, targetId, amount, action } = req.body;
  if (secret !== 'obnul2026') return res.status(403).json({ error: 'Forbidden' });
  if (!targetId || !amount) return res.status(400).json({ error: 'Missing params' });
  
  const currentBal = getBalance(targetId);
  let newBal;
  if (action === 'give') {
    newBal = currentBal + Math.abs(amount);
  } else if (action === 'take') {
    newBal = Math.max(0, currentBal - Math.abs(amount));
  } else {
    newBal = Math.abs(amount); // set exact
  }
  
  await setBalance(targetId, newBal);
  
  // Notify all clients about balance update
  io.emit('balance_update', { userId: targetId, balance: newBal });
  
  res.json({ ok: true, balance: newBal });
});
app.post('/api/admin/obnul', (req, res) => {
  const { secret } = req.body || {};
  if (secret !== 'obnul2026') return res.status(403).json({ error: 'Forbidden' });
  for (const uid in users) users[uid].balance = 0;
  wheel.bets = {};
  for (const uid in activated) activated[uid] = [];
  io.emit('admin:obnul');
  saveData();
  res.json({ ok: true });
});

// === ADMIN: GIVE BALANCE ===
app.post('/api/admin/give', (req, res) => {
  const { secret, userId, amount } = req.body || {};
  if (secret !== 'obnul2026') return res.status(403).json({ error: 'Forbidden' });
  if (!userId || !amount) return res.status(400).json({ error: 'Missing params' });
  const amt = Math.round(parseFloat(amount) * 100) / 100;
  if (!users[userId]) users[userId] = { balance: 0 };
  users[userId].balance += amt;
  io.emit('balance_update', { userId, balance: users[userId].balance });
  saveData();
  res.json({ ok: true, balance: users[userId].balance });
});

// === ADMIN: TAKE BALANCE ===
app.post('/api/admin/take', (req, res) => {
  const { secret, userId, amount } = req.body || {};
  if (secret !== 'obnul2026') return res.status(403).json({ error: 'Forbidden' });
  if (!userId || !amount) return res.status(400).json({ error: 'Missing params' });
  const amt = Math.round(parseFloat(amount) * 100) / 100;
  if (!users[userId]) users[userId] = { balance: 0 };
  users[userId].balance = Math.max(0, users[userId].balance - amt);
  io.emit('balance_update', { userId, balance: users[userId].balance });
  saveData();
  res.json({ ok: true, balance: users[userId].balance });
});
// === DATABASE (PostgreSQL on Railway, fallback to file) ===
const fs = require('fs');
const DATA_FILE = './data.json';

let db = null;
let usePostgres = false;

// Try to connect to PostgreSQL
try {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    usePostgres = true;
    console.log('🐘 PostgreSQL connected');
    
    // Create tables if not exist
    db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        balance REAL DEFAULT 0,
        first_name TEXT,
        last_name TEXT,
        username TEXT,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS promos (
        code TEXT PRIMARY KEY,
        amount REAL DEFAULT 0,
        uses INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS activated (
        user_id TEXT,
        code TEXT,
        activated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, code)
      );
      CREATE TABLE IF NOT EXISTS wheel_history (
        id SERIAL PRIMARY KEY,
        num INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `).then(() => {
      console.log('✅ DB tables ready');
    }).catch(e => {
      console.error('DB init error:', e.message);
    });
  }
} catch (e) {
  console.log('PostgreSQL not available, using file storage');
}

let users = {};
let promos = {
  '1': 200.00,
  '2': 200.00,
  '3': 200.00,
  '4': 200.00,
  '5': 200.00,
  '6': 200.00
};
let activated = {};
let transactions = [];

// Load data from file on start (fallback)
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    users = data.users || {};
    promos = data.promos || promos;
    activated = data.activated || {};
    transactions = data.transactions || [];
    console.log('📂 Loaded data from file:', Object.keys(users).length, 'users');
  }
} catch (e) {
  console.error('Failed to load data:', e);
}

// Save data to file (fallback)
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users, promos, activated, transactions }));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

// === DB HELPERS ===
async function dbGetUser(id) {
  if (usePostgres) {
    try {
      const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      if (res.rows[0]) return res.rows[0];
    } catch (e) {}
  }
  return users[id] || null;
}

async function dbSetUser(id, data) {
  if (usePostgres) {
    try {
      await db.query(`
        INSERT INTO users (id, balance, first_name, last_name, username, avatar)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          balance = EXCLUDED.balance,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          username = EXCLUDED.username,
          avatar = EXCLUDED.avatar
      `, [id, data.balance || 0, data.first_name || null, data.last_name || null, data.username || null, data.avatar || null]);
    } catch (e) {}
  }
  users[id] = { ...users[id], ...data };
  saveData();
}

async function dbGetAllUsers() {
  if (usePostgres) {
    try {
      const res = await db.query('SELECT * FROM users');
      return res.rows;
    } catch (e) {}
  }
  return Object.entries(users).map(([id, data]) => ({ id, ...data }));
}

// === TRANSACTION HELPERS ===
async function dbAddTx(type, userId, amount, detail, game) {
  var time = Date.now();
  // Always save to memory
  transactions.push({ type, userId, amount, detail, game, time });
  saveData();
  
  // Save to PostgreSQL
  if (usePostgres) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          type TEXT,
          user_id TEXT,
          amount REAL,
          detail TEXT,
          game TEXT,
          time BIGINT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.query(
        'INSERT INTO transactions (type, user_id, amount, detail, game, time) VALUES ($1, $2, $3, $4, $5, $6)',
        [type, userId, amount, detail || '', game || '', time]
      );
    } catch (e) {}
  }
}

async function dbGetUserTx(userId) {
  if (usePostgres) {
    try {
      var res = await db.query(
        'SELECT * FROM transactions WHERE user_id = $1 ORDER BY time DESC LIMIT 100',
        [userId]
      );
      return res.rows.map(r => ({
        type: r.type,
        userId: r.user_id,
        amount: r.amount,
        detail: r.detail,
        game: r.game,
        time: r.time
      }));
    } catch (e) {}
  }
  return transactions.filter(t => t.userId === userId);
}

async function dbDeleteUser(id) {
  if (usePostgres) {
    try {
      await db.query('DELETE FROM users WHERE id = $1', [id]);
    } catch (e) {}
  }
  delete users[id];
  saveData();
}

function getBalance(id) {
  // Always read from in-memory (synced with DB)
  return users[id]?.balance || 0;
}

async function setBalance(id, amt) {
  if (!users[id]) users[id] = { balance: 0 };
  users[id].balance = Math.round(amt * 100) / 100;
  
  if (usePostgres) {
    try {
      await db.query('UPDATE users SET balance = $1 WHERE id = $2', [users[id].balance, id]);
    } catch (e) {}
  }
  saveData();
}

// Add transaction to history
async function addTx(type, userId, amount, status, extra) {
  var time = Date.now();
  var detail = extra?.detail || type;
  var game = extra?.game || null;
  
  // Save to memory
  transactions.push({ type, userId, amount: Math.round(amount * 100) / 100, status, time, detail, game, ...extra });
  saveData();
  
  // Save to PostgreSQL
  if (usePostgres) {
    try {
      await db.query(
        'INSERT INTO transactions (type, user_id, amount, detail, game, time) VALUES ($1, $2, $3, $4, $5, $6)',
        [type, userId, Math.round(amount * 100) / 100, detail, game, time]
      );
    } catch (e) { console.error('DB tx error:', e.message); }
  }
}

// Get transaction history for user
app.get('/api/transactions/:userId', (req, res) => {
  const txs = transactions
    .filter(t => t.userId === req.params.userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 50);
  res.json({ ok: true, transactions: txs });
});

// === CRYPTOBOT API ===
const CRYPTOBOT_TOKEN = '411440:AAWUSDQWHE8fLkRQN20YRJi0DBb2skCPOdJ';
const CRYPTOBOT_URL = 'https://pay.crypt.bot/api';

async function cryptobot(method, params) {
  const res = await fetch(`${CRYPTOBOT_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Crypto-Pay-API-Token': CRYPTOBOT_TOKEN
    },
    body: JSON.stringify(params)
  });
  return res.json();
}

// Create invoice
app.post('/api/invoice', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount < 0.1) {
      return res.status(400).json({ error: 'Min amount: $0.1' });
    }

    const result = await cryptobot('createInvoice', {
      asset: 'USDT',
      amount: String(Number(amount).toFixed(2)),
      description: `Deposit for ${userId}`,
      payload: JSON.stringify({ userId }),
      expires_in: 1800,
      allow_anonymous: false,
      allow_comments: false
    });

    console.log('Cryptobot createInvoice:', JSON.stringify(result));

    if (result.ok) {
      res.json({
        ok: true,
        invoiceId: result.result.invoice_id,
        payUrl: result.result.bot_invoice_url
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to create invoice' });
    }
  } catch (e) {
    console.error('Invoice error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Check invoice
app.post('/api/invoice/check', async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ error: 'Missing invoiceId' });

    const result = await cryptobot('getInvoices', {
      invoice_ids: String(invoiceId),
      count: 1
    });

    console.log('Cryptobot getInvoices:', JSON.stringify(result));

    if (result.ok && result.result?.items?.length > 0) {
      const inv = result.result.items[0];

      // If paid, credit balance
      if (inv.status === 'paid') {
        try {
          const payload = JSON.parse(inv.payload || '{}');
          if (payload.userId) {
            setBalance(payload.userId, getBalance(payload.userId) + parseFloat(inv.amount));
            console.log(`Credited $${inv.amount} to ${payload.userId}`);
          }
        } catch (e) {}
      }

      res.json({ ok: true, status: inv.status, amount: inv.amount });
    } else {
      res.json({ ok: true, status: 'not_found' });
    }
  } catch (e) {
    console.error('Check error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Cryptobot webhook
app.post('/api/cryptobot-hook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const body = JSON.parse(req.body.toString());
    if (body.update_type === 'invoice_paid') {
      const payload = JSON.parse(body.payload.payload || '{}');
      if (payload.userId) {
        const amount = parseFloat(body.payload.amount);
        setBalance(payload.userId, getBalance(payload.userId) + amount);
        io.emit('balance_update', { userId: payload.userId, amount });
        console.log(`Webhook: Credited $${amount} to ${payload.userId}`);
      }
    }
  } catch (e) {
    console.error('Webhook error:', e);
  }
  res.json({ ok: true });
});

// === XROCKET API ===
const XROCKET_KEY = 'f391f7a440adb0cfb0f7a1afe';
const XROCKET_URL = 'https://pay.xrocket.tg/api/v1';

async function xrocket(method, params) {
  const isGet = !params;
  const url = `${XROCKET_URL}/${method}`;
  
  const options = {
    method: isGet ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'XR-API-Key': XROCKET_KEY
    }
  };
  
  if (!isGet) {
    options.body = JSON.stringify(params);
  }
  
  const res = await fetch(url, options);
  return res.json();
}

// Create xRocket invoice
app.post('/api/invoice/xrocket', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount < 0.1) {
      return res.status(400).json({ error: 'Min amount: $0.1' });
    }

    console.log('Creating xRocket invoice:', { userId, amount });

    const result = await xrocket('invoices', {
      amount: String(Number(amount).toFixed(2)),
      currency: 'TON',
      description: `Deposit for ${userId}`,
      payload: JSON.stringify({ userId }),
      expire: 1800
    });

    console.log('xRocket response:', JSON.stringify(result));

    if (result.success || result.data || result.invoice_id || result.id) {
      const invoice = result.data || result;
      const invoiceId = invoice.invoice_id || invoice.id;
      const payUrl = invoice.pay_url || invoice.bot_invoice_url || invoice.mini_app_invoice_url || `https://t.me/xRocket?start=invoice_${invoiceId}`;
      
      addTx('deposit', userId, Number(amount), 'pending', { provider: 'xrocket', invoiceId: String(invoiceId) });
      
      res.json({ ok: true, invoiceId: String(invoiceId), payUrl });
    } else {
      console.error('xRocket error:', result);
      res.status(500).json({ error: result.message || result.error || 'Failed to create invoice' });
    }
  } catch (e) {
    console.error('xRocket error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Check xRocket invoice
app.post('/api/invoice/check/xrocket', async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ error: 'Missing invoiceId' });

    const result = await xrocket(`invoices/${invoiceId}`);
    console.log('xRocket check:', JSON.stringify(result));

    if (result.success || result.data) {
      const inv = result.data || result;
      const status = inv.status || inv.state;
      
      if (status === 'paid' || status === 'completed' || status === 'success') {
        try {
          const payload = JSON.parse(inv.payload || '{}');
          if (payload.userId) {
            setBalance(payload.userId, getBalance(payload.userId) + parseFloat(inv.amount));
            const tx = transactions.find(t => t.invoiceId === String(invoiceId));
            if (tx) tx.status = 'completed';
            console.log(`xRocket: Credited $${inv.amount} to ${payload.userId}`);
          }
        } catch (e) {}
      }
      res.json({ ok: true, status, amount: inv.amount });
    } else {
      res.json({ ok: true, status: 'not_found' });
    }
  } catch (e) {
    console.error('xRocket check error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Withdraw via xRocket
app.post('/api/withdraw/xrocket', async (req, res) => {
  try {
    const { userId, amount, wallet } = req.body;
    if (!userId || !amount || amount < 1) return res.status(400).json({ error: 'Min $1' });
    
    const amt = Math.round(Number(amount) * 100) / 100;
    const fee = Math.round(amt * 0.03 * 100) / 100;
    const total = amt + fee;
    
    if (getBalance(userId) < total) return res.status(400).json({ error: 'Insufficient balance' });

    const result = await xrocket('transfers', {
      user_id: parseInt(userId) || 0,
      amount: String(amt.toFixed(2)),
      currency: 'TON'
    });

    if (result.success || result.data) {
      setBalance(userId, getBalance(userId) - total);
      addTx('withdraw', userId, amt, 'completed', { provider: 'xrocket' });
      res.json({ ok: true, received: amt, fee, balance: getBalance(userId) });
    } else {
      res.status(500).json({ error: result.message || result.error || 'Transfer failed' });
    }
  } catch (e) {
    console.error('xRocket withdraw error:', e);
    res.status(500).json({ error: e.message });
  }
});
// Withdraw via CryptoBot (auto payout)
app.post('/api/withdraw/cryptobot', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount < 1) return res.status(400).json({ error: 'Min $1' });
    
    const amt = Math.round(Number(amount) * 100) / 100;
    const fee = Math.round(amt * 0.03 * 100) / 100;
    const total = amt + fee;
    
    if (getBalance(userId) < total) return res.status(400).json({ error: 'Insufficient balance' });

    const tgId = parseInt(userId) || 0;
    if (!tgId) return res.status(400).json({ error: 'Invalid user ID for transfer' });

    const spendId = 'wd_' + userId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const result = await cryptobot('transfer', {
      user_id: tgId,
      asset: 'USDT',
      amount: String(amt.toFixed(2)),
      spend_id: spendId
    });

    console.log('CryptoBot transfer:', JSON.stringify(result));

    if (result.ok) {
      setBalance(userId, getBalance(userId) - total);
      addTx('withdraw', userId, amt, 'completed', { provider: 'cryptobot' });
      io.emit('balance_update', { userId, balance: getBalance(userId) });
      res.json({ ok: true, received: amt, fee, balance: getBalance(userId) });
    } else {
      res.status(500).json({ error: result.error || 'Transfer failed' });
    }
  } catch (e) {
    console.error('CryptoBot withdraw error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/promos/:code/activate', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const userId = req.body?.userId;
  if (!promos[code]) return res.status(404).json({ error: 'Promo not found' });
  if (!activated[userId]) activated[userId] = [];
  if (activated[userId].includes(code)) return res.status(400).json({ error: 'Already activated' });
  activated[userId].push(code);
  setBalance(userId, getBalance(userId) + promos[code]);
  res.json({ ok: true, amount: promos[code], balance: getBalance(userId) });
});

// === WHEEL GAME ===
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

function isRed(n) { return RED.includes(n); }
function betWins(type, num) {
  if (type === '0') return num === 0;
  if (type === 'red') return isRed(num);
  if (type === 'black') return num > 0 && !isRed(num);
  if (type === 'odd') return num > 0 && num % 2 === 0;
  if (type === 'notodd') return num > 0 && num % 2 === 1;
  if (type === 'range1') return num >= 1 && num <= 18;
  if (type === 'range2') return num >= 19 && num <= 36;
  if (type === 'range3') return num >= 1 && num <= 12;
  if (type === 'range4') return num >= 13 && num <= 24;
  if (type === 'range5') return num >= 25 && num <= 36;
  if (!isNaN(Number(type))) return num === Number(type);
  return false;
}
function getCoef(type) {
  if (type === '0' || !isNaN(Number(type))) return 36;
  if (['range3','range4','range5'].includes(type)) return 3;
  return 2;
}

let wheel = { phase: 'betting', timer: 20, roundId: 0, result: null, bets: {}, history: [] };
let wheelTimer = null;

function startWheel() {
  if (wheelTimer) clearInterval(wheelTimer);
  wheel.timer = 20;
  wheel.phase = 'betting';
  io.emit('wheel:timer', { timer: 20, phase: 'betting' });
  wheelTimer = setInterval(() => {
    wheel.timer--;
    io.emit('wheel:timer', { timer: wheel.timer, phase: wheel.phase });
    if (wheel.timer <= 0) {
      clearInterval(wheelTimer);
      spinWheel();
    }
  }, 1000);
}

function spinWheel() {
  wheel.phase = 'spinning';
  const idx = Math.floor(Math.random() * WHEEL.length);
  const num = WHEEL[idx];
  const color = num === 0 ? 'green' : isRed(num) ? 'red' : 'black';

  const allBets = [];
  for (const uid in wheel.bets) {
    wheel.bets[uid].forEach(b => allBets.push({ userId: uid, type: b.type, amount: b.amount, playerName: b.playerName || 'Player' }));
  }

  const results = {};
  for (const uid in wheel.bets) {
    let win = 0;
    let totalBet = 0;
    wheel.bets[uid].forEach(b => { 
      totalBet += b.amount;
      if (betWins(b.type, num)) win += b.amount * getCoef(b.type); 
    });
    win = Math.round(win * 100) / 100;
    results[uid] = win;
    setBalance(uid, getBalance(uid) + win);
    // Record transaction
    addTx('bet', uid, totalBet, 'completed', { game: 'Wheel', detail: `Bet ${totalBet.toFixed(2)}` });
    if (win > 0) {
      addTx('win', uid, win, 'completed', { game: 'Wheel', detail: `Won ${win.toFixed(2)} on ${num}` });
    } else {
      addTx('loss', uid, totalBet, 'completed', { game: 'Wheel', detail: `Lost on ${num}` });
    }
  }

  wheel.result = { num, color, index: idx };
  wheel.history.unshift({ num, color });
  if (wheel.history.length > 20) wheel.history.pop();

  const balances = {};
  for (const uid in wheel.bets) { balances[uid] = getBalance(uid); }
  io.emit('wheel:spin', { result: wheel.result, allBets, results, history: wheel.history, balances });
  for (const uid in balances) {
    io.emit('balance_update', { userId: uid, balance: balances[uid] });
  }

  setTimeout(() => {
    wheel.bets = {};
    wheel.result = null;
    wheel.roundId++;
    startWheel();
    io.emit('wheel:newRound', { roundId: wheel.roundId, history: wheel.history });
  }, 7000);
}

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || '0';
  if(userId && userId !== '0') {
    if (!users[userId]) {
      users[userId] = { balance: 0 };
      saveData();
    }
  }
  socket.emit('wheel:state', { phase: wheel.phase, timer: wheel.timer, myBets: wheel.bets[userId] || [], balance: getBalance(userId) || 0, history: wheel.history });

  socket.on('wheel:bet', (data) => {
    if (wheel.phase !== 'betting') return;
    const { type, amount, playerName, playerAvatar } = data;
    if (!type || !amount || amount <= 0) return;
    const currentServerBets = (wheel.bets[userId] || []).reduce((s, b) => s + b.amount, 0);
    const serverBalance = getBalance(userId);
    if (currentServerBets + amount > serverBalance) {
      socket.emit('wheel:myBets', { myBets: wheel.bets[userId] || [], balance: serverBalance });
      return;
    }
    if (!wheel.bets[userId]) wheel.bets[userId] = [];
    wheel.bets[userId].push({ type, amount, playerName: playerName || 'Player', playerAvatar: playerAvatar || '' });
    setBalance(userId, serverBalance - amount);
    addTx('bet', userId, amount, 'completed', { game: 'Wheel', detail: type });
    io.emit('balance_update', { userId, balance: getBalance(userId) });
    const allBets = [];
    for (const uid in wheel.bets) {
      wheel.bets[uid].forEach(b => allBets.push({ userId: uid, type: b.type, amount: b.amount, playerName: b.playerName, playerAvatar: b.playerAvatar || '' }));
    }
    io.emit('wheel:betsUpdate', { allBets });
    socket.emit('wheel:myBets', { myBets: wheel.bets[userId] || [], balance: getBalance(userId) });
  });
});

startWheel();

// === TELEGRAM PHOTO API ===
const BOT_TOKEN = process.env.BOT_TOKEN || '8962248830:AAEoWT12lZEzttXXHxt3c48wLGh5HcZ6FoQ';

app.get('/api/tg-photo/:id', async (req, res) => {
  if (!BOT_TOKEN) return res.status(404).send('No bot token');
  try {
    const userId = req.params.id;
    const photosRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`);
    const photos = await photosRes.json();
    if (!photos.ok || !photos.result?.total_count) return res.status(404).send('No photo');
    const fileId = photos.result.photos[0][0].file_id;
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const file = await fileRes.json();
    if (!file.ok || !file.result?.file_path) return res.status(404).send('No file');
    const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.result.file_path}`;
    const imgRes = await fetch(photoUrl);
    const buffer = await imgRes.buffer();
    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);
  } catch (e) {
    console.error('Photo error:', e);
    res.status(500).send('Error');
  }
});

// === START ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// === INIT DB ===
async function initDb() {
  console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('🔍 usePostgres:', usePostgres);
  if (!usePostgres) {
    console.log('⚠️ PostgreSQL not configured — transactions will NOT be saved permanently!');
    return;
  }
  try {
    // Create tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        balance REAL DEFAULT 0,
        first_name TEXT,
        last_name TEXT,
        username TEXT,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type TEXT,
        user_id TEXT,
        amount REAL,
        detail TEXT,
        game TEXT,
        time BIGINT,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Load users from DB to memory
    const res = await db.query('SELECT * FROM users');
    res.rows.forEach(row => {
      users[row.id] = { balance: row.balance, first_name: row.first_name, last_name: row.last_name, username: row.username, avatar: row.avatar };
    });
    console.log('🐘 Loaded', res.rows.length, 'users from PostgreSQL');
    
    // Transactions are loaded on-demand per user
  } catch (e) {
    console.error('DB init error:', e.message);
  }
}
initDb();

// Bot disabled — run separately via bot.js
// Set SERVER_URL env var on Railway for bot to work
