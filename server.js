const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname));

// CryptoBot webhook must be parsed as raw JSON before express.json()
app.post('/api/cryptobot-hook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (body.update_type === 'invoice_paid') {
      const inv = body.invoice || body.payload || body;
      const payload = parsePayload(inv.payload || body.payload);
      const uid = payload.userId || inv.userId || body.user_id;
      const amount = parseFloat(inv.amount || inv.total || body.amount || body.payload?.amount);
      const invoiceId = inv.invoice_id || inv.id || body.invoice_id;

      if (!uid || isNaN(amount) || amount <= 0) {
        console.log('[WAGER] CryptoBot webhook skipped:', { uid, amount, invoiceId });
        return res.json({ ok: true, skipped: true });
      }

      const credited = await creditDeposit(String(uid), amount, 'cryptobot', invoiceId ? String(invoiceId) : null);
      if (!credited.ok && !credited.already) {
        return res.status(500).json({ ok: false, error: credited.error || 'Credit failed' });
      }
      console.log(`Webhook: Credited $${amount} to ${uid}, wager=$${credited.wager_required || 0}`);
    }
  } catch (e) {
    console.error('Webhook error:', e);
    return res.status(400).json({ ok: false, error: e.message });
  }
  res.json({ ok: true });
});

app.use(express.json());

// === GET USER BALANCE ===
app.get('/api/users', async (req, res) => {
  const id = req.query.id;
  if (id) {
    const dbUser = await dbGetUser(id);
    if (dbUser) {
      const { id: uid, ...rest } = dbUser;
      return res.json({ ok: true, balance: dbUser.balance, wager_required: dbUser.wager_required || 0, wager_total: dbUser.wager_total || 0, deposit_total: dbUser.deposit_total || 0, ...rest });
    }
    const bal = getBalance(id);
    const u = users[id] || {};
    return res.json({ ok: true, balance: bal, wager_required: u.wager_required || 0, wager_total: u.wager_total || 0, deposit_total: u.deposit_total || 0 });
  }
  const userList = await dbGetAllUsers();
  res.json(userList);
});

// === ADD TRANSACTION (client-called) ===
app.post('/api/transaction', async (req, res) => {
  const { userId, type, amount, detail } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!userId || !type || !amount) return res.status(400).json({ error: 'Missing params' });
  await addTx(type, userId, Math.abs(amount), 'completed', { game: detail, ip });
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
  
  // Get user's last IP from transactions
  let lastIp = 'Неизвестно';
  for(let i = userTx.length - 1; i >= 0; i--){
    if(userTx[i].ip || userTx[i]?.detail?.ip){
      lastIp = userTx[i].ip || userTx[i]?.detail?.ip;
      break;
    }
  }
  
  const games = Math.max(wins + losses);
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;
  
  res.json({ deposits, withdraws, totalWin, maxWin, totalBets, games, wins, losses, winRate, history, ip: lastIp });
});

app.post('/api/users', async (req, res) => {
   const { id, balance, first_name, last_name, username, avatar, wager_required, wager_total, deposit_total, wager_multiplier } = req.body;
   if (!id) return res.status(400).json({ error: 'Missing id' });
  if (!users[id]) users[id] = { balance: 0, wager_required: 0, wager_total: 0, deposit_total: 0, wager_multiplier: 3 };
    if (balance !== undefined) {
      users[id].balance = Math.round(parseFloat(balance) * 100) / 100;
    }
    if (wager_required !== undefined) users[id].wager_required = Math.round(parseFloat(wager_required) * 100) / 100;
    if (wager_total !== undefined) users[id].wager_total = Math.round(parseFloat(wager_total) * 100) / 100;
    if (deposit_total !== undefined) users[id].deposit_total = Math.round(parseFloat(deposit_total) * 100) / 100;
    if (wager_multiplier !== undefined) users[id].wager_multiplier = parseFloat(wager_multiplier);
    if (first_name !== undefined) users[id].first_name = first_name;
    if (last_name !== undefined) users[id].last_name = last_name;
    if (username !== undefined) users[id].username = username;
    if (avatar !== undefined) users[id].avatar = avatar;
    
    // Save to DB immediately
    await dbSetUser(id, users[id]);
    res.json({ ok: true, balance: users[id].balance, wager_required: users[id].wager_required, deposit_total: users[id].deposit_total });
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
   for (const uid in users) {
     users[uid].balance = 0;
     users[uid].wager_required = 0;
     users[uid].wager_total = 0;
     users[uid].wager_multiplier = 3;
     if (usePostgres) {
       try {
         db.query('UPDATE users SET balance=0, wager_required=0, wager_total=0, wager_multiplier=3 WHERE id=$1', [uid]);
       } catch(e) {}
     }
   }
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
// (old subscribe endpoint removed — replaced below with TG API check)

// === DATABASE (PostgreSQL on Railway, fallback to file) ===
const fs = require('fs');
const DATA_FILE = './data.json';

// PostgreSQL setup — deferred to startServer()
let db = null;
let usePostgres = !!process.env.DATABASE_URL;
if (usePostgres) {
  try {
    const { Pool } = require('pg');
    db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log('🐘 PostgreSQL pool created');
  } catch (e) {
    console.log('⚠️  Failed to create PG pool:', e.message);
    usePostgres = false;
  }
} else {
  console.log('⚠️  No DATABASE_URL — data will be lost on restart!');
}

let users = {};
let promos = {};
let activated = {};
let transactions = [];
let paidInvoices = {};

// Load promos from PG on start
async function loadPromosFromPG() {
  if (!usePostgres) return;
  try {
    const res = await db.query('SELECT code, amount, uses, wager_mult FROM promos');
    res.rows.forEach(row => {
      promos[row.code] = {
        amount: parseFloat(row.amount) || 0,
        uses: parseInt(row.uses) || 0,
        wager_mult: parseFloat(row.wager_mult) || 5
      };
    });
    if (res.rows.length > 0) console.log('🐘 Loaded', res.rows.length, 'promos from PG');
  } catch(e) { console.error('PG load promos error:', e.message); }
}

// Save promo to DB
async function savePromoToDB(code, data) {
  if (!usePostgres) return;
  try {
    await db.query(`
      INSERT INTO promos (code, amount, uses, wager_mult)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (code) DO UPDATE SET
        amount = EXCLUDED.amount,
        uses = EXCLUDED.uses,
        wager_mult = EXCLUDED.wager_mult
    `, [code, data.amount || 0, data.uses || 0, data.wager_mult || 5]);
  } catch(e) { console.error('[DB] savePromo error:', e.message); }
}

// Delete promo from DB
async function deletePromoFromDB(code) {
  if (!usePostgres) return;
  try {
    await db.query('DELETE FROM promos WHERE code = $1', [code]);
  } catch(e) { console.error('[DB] deletePromo error:', e.message); }
}

// Load data from file on start (fallback)
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    users = data.users || {};
    promos = data.promos || promos;
    activated = data.activated || {};
    transactions = data.transactions || [];
    paidInvoices = data.paidInvoices || {};
    console.log('📂 Loaded data from file:', Object.keys(users).length, 'users');
  }
} catch (e) {
  console.error('Failed to load data:', e);
}

// Load users from PostgreSQL on start (overrides file data if PG is available)
async function loadUsersFromPG() {
  if (!usePostgres) return;
  try {
    const result = await db.query('SELECT * FROM users');
    console.log('🐘 PG load result:', result.rows.length, 'users');
    result.rows.forEach(row => {
      users[row.id] = {
        balance: parseFloat(row.balance) || 0,
        bonus_balance: parseFloat(row.bonus_balance) || 0,
        wager_required: parseFloat(row.wager_required) || 0,
        wager_total: parseFloat(row.wager_total) || 0,
        deposit_total: parseFloat(row.deposit_total) || 0,
        wager_multiplier: parseFloat(row.wager_multiplier) || 3,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        username: row.username || null,
        avatar: row.avatar || null,
        sub_claimed: row.sub_claimed || false
      };
    });
    console.log('🐘 Loaded from PostgreSQL:', Object.keys(users).length, 'users');
    if (result.rows.length > 0) {
      const sample = result.rows[0];
      console.log('🐘 Sample user:', sample.id, 'bal:', sample.balance, 'wager:', sample.wager_required);
    }
  } catch(e) { console.error('PG load error:', e.message); }
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
       // Ensure user exists in memory with all fields before saving
       if (!users[id]) users[id] = {};
       const u = users[id];
       // Merge: use provided data, fallback to existing memory values
       const row = {
         balance: data.balance !== undefined ? data.balance : (u.balance || 0),
         bonus_balance: data.bonus_balance !== undefined ? data.bonus_balance : (u.bonus_balance || 0),
         first_name: data.first_name !== undefined ? data.first_name : (u.first_name || null),
         last_name: data.last_name !== undefined ? data.last_name : (u.last_name || null),
         username: data.username !== undefined ? data.username : (u.username || null),
         avatar: data.avatar !== undefined ? data.avatar : (u.avatar || null),
         sub_claimed: data.sub_claimed !== undefined ? data.sub_claimed : (u.sub_claimed || false),
         wager_required: data.wager_required !== undefined ? data.wager_required : (u.wager_required || 0),
         wager_total: data.wager_total !== undefined ? data.wager_total : (u.wager_total || 0),
         deposit_total: data.deposit_total !== undefined ? data.deposit_total : (u.deposit_total || 0),
         wager_multiplier: data.wager_multiplier !== undefined ? data.wager_multiplier : (u.wager_multiplier || 3),
       };
       await db.query(`
         INSERT INTO users (id, balance, bonus_balance, first_name, last_name, username, avatar, sub_claimed, wager_required, wager_total, deposit_total, wager_multiplier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           balance = EXCLUDED.balance,
           bonus_balance = EXCLUDED.bonus_balance,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           username = EXCLUDED.username,
           avatar = EXCLUDED.avatar,
           sub_claimed = EXCLUDED.sub_claimed,
           wager_required = EXCLUDED.wager_required,
           wager_total = EXCLUDED.wager_total,
           deposit_total = EXCLUDED.deposit_total,
           wager_multiplier = EXCLUDED.wager_multiplier
       `, [id, row.balance, row.bonus_balance, row.first_name, row.last_name, row.username, row.avatar, row.sub_claimed, row.wager_required, row.wager_total, row.deposit_total, row.wager_multiplier]);
     } catch(e) { console.error('[DB] dbSetUser error for', id, ':', e.message); }
   }
   users[id] = data;
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
   if (!users[id]) {
     if (usePostgres) {
       try {
         const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
         if (res.rows[0]) {
           const r = res.rows[0];
           users[id] = {
             balance: parseFloat(r.balance) || 0,
             bonus_balance: parseFloat(r.bonus_balance) || 0,
             wager_required: parseFloat(r.wager_required) || 0,
             wager_total: parseFloat(r.wager_total) || 0,
             deposit_total: parseFloat(r.deposit_total) || 0,
             wager_multiplier: parseFloat(r.wager_multiplier) || 3,
             first_name: r.first_name || null,
             last_name: r.last_name || null,
             username: r.username || null,
             avatar: r.avatar || null,
             sub_claimed: r.sub_claimed || false
           };
         }
       } catch(e) { console.error('[DB] setBalance load error:', e.message); }
     }
     if (!users[id]) users[id] = { balance: 0, bonus_balance: 0, wager_required: 0, wager_total: 0, deposit_total: 0, wager_multiplier: 3 };
   }
   users[id].balance = Math.round(amt * 100) / 100;

   // If balance depleted and wager not completed — reset wager
   if (users[id].balance <= 0.001 && (users[id].wager_required || 0) > 0) {
     console.log(`[WAGER] Balance depleted for ${id} ($${users[id].balance.toFixed(2)}) — resetting wager $${users[id].wager_required.toFixed(2)} → 0`);
     users[id].wager_required = 0;
     // Persist wager reset to DB immediately
     if (usePostgres) {
       try { await db.query('UPDATE users SET wager_required = 0 WHERE id = $1', [id]); } catch(e) {}
     }
   }

   if (usePostgres) {
      try {
        const u = users[id];
        db.query(`
         INSERT INTO users (id, balance, bonus_balance, wager_required, wager_total, deposit_total, wager_multiplier)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           balance = EXCLUDED.balance,
           bonus_balance = EXCLUDED.bonus_balance,
           wager_required = EXCLUDED.wager_required,
           wager_total = EXCLUDED.wager_total,
           deposit_total = EXCLUDED.deposit_total,
           wager_multiplier = EXCLUDED.wager_multiplier
       `, [id, users[id].balance, u.bonus_balance || 0, u.wager_required || 0, u.wager_total || 0, u.deposit_total || 0, u.wager_multiplier || 3]);
     } catch (e) { console.error('[DB] setBalance save error:', e.message); }
   }
   saveData();
 }

// === WAGER SYSTEM ===
// When user deposits, add to wager requirement
// When user bets, reduce wager requirement
// Withdraw only allowed when wager_required <= 0

const WAGER_MULT_DEFAULT = 3; // deposit × 3
const WAGER_MULT_PROMO = 5;   // promo × 5

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch (e) { return {}; }
  }
  if (typeof payload === 'object') return payload;
  return {};
}

async function markPaidInvoice(provider, invoiceId, userId, amount) {
  if (!provider || !invoiceId) return true;
  const key = provider + ':' + invoiceId;
  if (usePostgres) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS paid_invoices (
          provider TEXT,
          invoice_id TEXT,
          user_id TEXT,
          amount REAL,
          time BIGINT,
          PRIMARY KEY (provider, invoice_id)
        )
      `);
      const res = await db.query(
        'INSERT INTO paid_invoices (provider, invoice_id, user_id, amount, time) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (provider, invoice_id) DO NOTHING RETURNING invoice_id',
        [provider, String(invoiceId), String(userId), Math.round(parseFloat(amount) * 100) / 100, Date.now()]
      );
      return res.rowCount > 0;
    } catch (e) {
      console.error('[WAGER] paid_invoices error:', e.message);
      paidInvoices[key] = { provider, invoiceId, userId, amount: Math.round(parseFloat(amount) * 100) / 100, time: Date.now() };
      saveData();
      return true;
    }
  }
  if (paidInvoices[key]) return false;
  paidInvoices[key] = { provider, invoiceId, userId, amount: Math.round(parseFloat(amount) * 100) / 100, time: Date.now() };
  saveData();
  return true;
}

async function creditDeposit(userIdStr, amount, provider, invoiceId) {
  const depAmount = Math.round(parseFloat(amount) * 100) / 100;
  const id = String(userIdStr || '');
  if (!id || isNaN(depAmount) || depAmount <= 0) {
    return { ok: false, error: !id ? 'Missing userId' : 'Invalid amount' };
  }

  const wasPaid = await markPaidInvoice(provider, invoiceId, id, depAmount);
  if (!wasPaid) return { ok: false, already: true };

  if (!users[id]) users[id] = { balance: 0, bonus_balance: 0, wager_required: 0, wager_total: 0, deposit_total: 0, wager_multiplier: WAGER_MULT_DEFAULT };
  const u = users[id];
  u.balance = Math.round((getBalance(id) + depAmount) * 100) / 100;
  u.wager_required = Math.round((u.wager_required + depAmount * WAGER_MULT_DEFAULT) * 100) / 100;
  u.wager_total = Math.round((u.wager_total + depAmount * WAGER_MULT_DEFAULT) * 100) / 100;
  u.deposit_total = Math.round((u.deposit_total + depAmount) * 100) / 100;
  u.wager_multiplier = WAGER_MULT_DEFAULT;
  users[id] = u;

  await addTx('deposit', id, depAmount, 'completed', { provider, invoiceId: invoiceId || null });
  saveData();

  if (usePostgres) {
    try {
      await db.query(`
        INSERT INTO users (id, balance, bonus_balance, wager_required, wager_total, deposit_total, wager_multiplier) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET 
          balance = EXCLUDED.balance,
          bonus_balance = EXCLUDED.bonus_balance,
          wager_required = EXCLUDED.wager_required,
          wager_total = EXCLUDED.wager_total,
          deposit_total = EXCLUDED.deposit_total,
          wager_multiplier = EXCLUDED.wager_multiplier
      `, [id, u.balance, u.bonus_balance || 0, u.wager_required, u.wager_total, u.deposit_total, u.wager_multiplier]);
    } catch (e) {
      console.error('[WAGER] Credit PG error:', e.message);
    }
  }

  io.emit('balance_update', { userId: id, balance: u.balance });
  return { ok: true, balance: u.balance, wager_required: u.wager_required, deposit_total: u.deposit_total };
}

function getWagerStatus(userId) {
  var u = users[userId];
  if (!u) return { wager_required: 0, wager_total: 0, deposit_total: 0, can_withdraw: true };
  return {
    wager_required: Math.max(0, u.wager_required || 0),
    wager_total: u.wager_total || 0,
    deposit_total: u.deposit_total || 0,
    can_withdraw: (u.wager_required || 0) <= 0
  };
}

async function applyDeposit(userId, amount) {
   console.log(`[WAGER] applyDeposit: user=${userId}, amount=$${amount}`);
   if (!users[userId]) users[userId] = { balance: 0, wager_required: 0, wager_total: 0, deposit_total: 0, wager_multiplier: 3 };
   var u = users[userId];
   u.wager_required = Math.round((u.wager_required + amount * WAGER_MULT_DEFAULT) * 100) / 100;
   u.wager_total = Math.round((u.wager_total + amount * WAGER_MULT_DEFAULT) * 100) / 100;
   u.deposit_total = Math.round((u.deposit_total + amount) * 100) / 100;
u.wager_multiplier = WAGER_MULT_DEFAULT;
    console.log(`[WAGER] New wager_required=$${u.wager_required}, wager_total=$${u.wager_total}`);
    saveData();
    if (usePostgres) {
      try {
        await db.query(`
          INSERT INTO users (id, balance, bonus_balance, wager_required, wager_total, deposit_total, wager_multiplier) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET 
            balance = EXCLUDED.balance,
            bonus_balance = EXCLUDED.bonus_balance,
            wager_required = EXCLUDED.wager_required,
            wager_total = EXCLUDED.wager_total,
            deposit_total = EXCLUDED.deposit_total,
            wager_multiplier = EXCLUDED.wager_multiplier
        `, [userId, u.balance || 0, u.bonus_balance || 0, u.wager_required, u.wager_total, u.deposit_total, u.wager_multiplier]);
        console.log('[WAGER] Saved to PostgreSQL');
      } catch(e) { console.error('[WAGER] PG error:', e.message); }
    }
  }

async function applyPromo(userId, amount) {
   if (!users[userId]) users[userId] = { balance: 0, wager_required: 0, wager_total: 0, deposit_total: 0, wager_multiplier: 5 };
   var u = users[userId];
   u.wager_required = Math.round((u.wager_required + amount * WAGER_MULT_PROMO) * 100) / 100;
   u.wager_total = Math.round((u.wager_total + amount * WAGER_MULT_PROMO) * 100) / 100;
   u.wager_multiplier = WAGER_MULT_PROMO;
   saveData();
   if (usePostgres) {
     try {
       await db.query(`
         INSERT INTO users (id, wager_required, wager_total, wager_multiplier) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET wager_required=$2, wager_total=$3, wager_multiplier=$4
       `, [userId, u.wager_required, u.wager_total, u.wager_multiplier]);
     } catch(e) {}
   }
 }

async function applyBet(userId, amount) {
   if (!users[userId]) return;
   var u = users[userId];
   u.wager_required = Math.round(Math.max(0, u.wager_required - amount) * 100) / 100;
   saveData();
   if (usePostgres) {
     try {
       await db.query('UPDATE users SET wager_required=$1 WHERE id=$2', [u.wager_required, userId]);
     } catch(e) {}
   }
 }

// API: Apply bet to wager (called by client games)
app.post('/api/wager/bet', async (req, res) => {
   const { userId, amount } = req.body;
   if (!userId || !amount) return res.status(400).json({ error: 'Missing params' });
   await applyBet(userId, Math.abs(amount));
   res.json({ ok: true, ...getWagerStatus(userId) });
});

// API: Report loss — if balance is 0 and wager not completed, reset wager to 0
app.post('/api/wager/loss', async (req, res) => {
   const { userId, amount } = req.body;
   if (!userId) return res.status(400).json({ error: 'Missing params' });
   const uid = String(userId);
   if (!users[uid]) {
     // Try to load from DB
     if (usePostgres) {
       try {
         const r = await db.query('SELECT * FROM users WHERE id = $1', [uid]);
         if (r.rows[0]) {
           const row = r.rows[0];
           users[uid] = {
             balance: parseFloat(row.balance) || 0,
             bonus_balance: parseFloat(row.bonus_balance) || 0,
             wager_required: parseFloat(row.wager_required) || 0,
             wager_total: parseFloat(row.wager_total) || 0,
             deposit_total: parseFloat(row.deposit_total) || 0,
             wager_multiplier: parseFloat(row.wager_multiplier) || 3,
             first_name: row.first_name || null,
             last_name: row.last_name || null,
             username: row.username || null,
             avatar: row.avatar || null,
             sub_claimed: row.sub_claimed || false
           };
         }
       } catch(e) {}
     }
     if (!users[uid]) return res.json({ ok: true, wager_reset: false, reason: 'User not found' });
   }
   const bal = getBalance(uid);
   let wagerReset = false;
   // If balance is 0 (or very close) and there's remaining wager, reset it
   if (bal <= 0.001 && (users[uid].wager_required || 0) > 0) {
     users[uid].wager_required = 0;
     wagerReset = true;
     // Persist to DB
     if (usePostgres) {
       try {
         await db.query('UPDATE users SET wager_required = 0 WHERE id = $1', [uid]);
       } catch(e) { console.error('[DB] wager reset error:', e.message); }
     }
     saveData();
     console.log(`[WAGER] Reset wager for ${uid} — balance depleted ($${bal.toFixed(2)})`);
   }
   res.json({ ok: true, wager_reset: wagerReset, ...getWagerStatus(uid) });
});

// API: Get wager status
app.get('/api/wager/:userId', (req, res) => {
   const uid = String(req.params.userId);
   console.log('[WAGER API] Getting status for user:', uid);
   const status = getWagerStatus(uid);
   console.log('[WAGER API] Status:', status);
   res.json({ ok: true, ...status });
 });

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
    .sort((a, b) => (b.time || 0) - (a.time || 0))
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

     const userIdStr = String(userId);
     const result = await cryptobot('createInvoice', {
       asset: 'USDT',
       amount: String(Number(amount).toFixed(2)),
       description: `Deposit for ${userIdStr}`,
       payload: JSON.stringify({ userId: userIdStr }),
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

// API: Debug user data
app.get('/api/debug/:userId', async (req, res) => {
   const uid = String(req.params.userId);
   if (usePostgres) {
     try {
       const result = await db.query('SELECT * FROM users WHERE id = $1', [uid]);
       res.json({ ok: true, postgres: result.rows[0] || null, memory: users[uid] || null });
     } catch(e) {
       res.json({ ok: false, error: e.message });
     }
   } else {
     res.json({ ok: true, memory: users[uid] || null, postgres: null });
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

      // If paid, credit balance + apply wager
      if (inv.status === 'paid' || inv.status === 'completed' || inv.status === 'success') {
        try {
          const payload = parsePayload(inv.payload);
          const userIdStr = String(payload.userId || inv.user_id || '');
          const depAmount = parseFloat(inv.amount);
          const invoiceId = inv.invoice_id || inv.id || invoiceId;

          if (!payload.userId || isNaN(depAmount) || depAmount <= 0) {
            console.error('[WAGER] Invalid invoice data:', { payload, amount: inv.amount, invoiceId });
          } else {
            const credited = await creditDeposit(userIdStr, depAmount, 'cryptobot', invoiceId ? String(invoiceId) : null);
            if (!credited.ok && !credited.already) {
              console.error('[WAGER] Credit failed:', credited.error);
            } else {
              console.log(`[WAGER] Credited $${depAmount} to ${userIdStr}, wager=$${credited.wager_required || 0}`);
            }
          }
        } catch (e) {
          console.error('[WAGER] Error:', e);
        }
      } else {
        console.log('[WAGER] Invoice status:', inv.status, '(not paid)');
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

     const userIdStr = String(userId);
     console.log('Creating xRocket invoice:', { userId: userIdStr, amount });

     const result = await xrocket('invoices', {
       amount: String(Number(amount).toFixed(2)),
       currency: 'TON',
       description: `Deposit for ${userIdStr}`,
       payload: JSON.stringify({ userId: userIdStr }),
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
             const payload = parsePayload(inv.payload);
             const uid = payload.userId || inv.userId || inv.user_id;
             const userIdStr = String(uid || '');
             const amount = parseFloat(inv.amount || inv.total);
             const invoiceId = inv.invoice_id || inv.id;

             if (!uid || isNaN(amount) || amount <= 0) {
               console.error('[WAGER] xRocket: Invalid invoice data:', { payload, amount: inv.amount, invoiceId });
             } else {
               const credited = await creditDeposit(userIdStr, amount, 'xrocket', invoiceId ? String(invoiceId) : null);
               if (!credited.ok && !credited.already) {
                 console.error('[WAGER] xRocket credit failed:', credited.error);
               } else {
                 console.log(`xRocket: Credited $${amount} to ${userIdStr}, wager=$${credited.wager_required || 0}`);
               }
             }
           } catch (e) { console.error('xRocket check error:', e); }
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
    const { userId, amount } = req.body;
    if (!userId || !amount || amount < 1.05) return res.status(400).json({ error: 'Min $1.05' });
    
    // Check wager status
    var wager = getWagerStatus(userId);
    if (!wager.can_withdraw) return res.status(400).json({ error: 'Wager not completed. Remaining: $' + wager.wager_required.toFixed(2) });
    
    const amt = Math.round(Number(amount) * 100) / 100;
    const fee = Math.round(amt * 0.03 * 100) / 100;
    const net = Math.round((amt - fee) * 100) / 100;
    
    if (getBalance(userId) < amt) return res.status(400).json({ error: 'Insufficient balance' });

    const result = await xrocket('transfers', {
      user_id: parseInt(userId) || 0,
      amount: String(net.toFixed(2)),
      currency: 'TON'
    });

    if (result.success || result.data) {
      setBalance(userId, getBalance(userId) - amt);
      addTx('withdraw', userId, amt, 'completed', { provider: 'xrocket', fee });
      res.json({ ok: true, received: net, fee, sent: amt, balance: getBalance(userId) });
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
    if (!userId || !amount || amount < 1.05) return res.status(400).json({ error: 'Min $1.05' });
    
    // Check wager status
    var wager = getWagerStatus(userId);
    if (!wager.can_withdraw) return res.status(400).json({ error: 'Wager not completed. Remaining: $' + wager.wager_required.toFixed(2) });
    
    const amt = Math.round(Number(amount) * 100) / 100;
    const fee = Math.round(amt * 0.03 * 100) / 100;
    const net = Math.round((amt - fee) * 100) / 100;
    
    if (getBalance(userId) < amt) return res.status(400).json({ error: 'Insufficient balance' });

    const tgId = parseInt(userId) || 0;
    if (!tgId) return res.status(400).json({ error: 'Invalid user ID for transfer' });

    const spendId = 'wd_' + userId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const result = await cryptobot('transfer', {
      user_id: tgId,
      asset: 'USDT',
      amount: String(net.toFixed(2)),
      spend_id: spendId
    });

    console.log('CryptoBot transfer:', JSON.stringify(result));

    if (result.ok) {
      setBalance(userId, getBalance(userId) - amt);
      addTx('withdraw', userId, amt, 'completed', { provider: 'cryptobot', fee });
      io.emit('balance_update', { userId, balance: getBalance(userId) });
      res.json({ ok: true, received: net, fee, sent: amt, balance: getBalance(userId) });
    } else {
      res.status(500).json({ error: result.error || 'Transfer failed' });
    }
  } catch (e) {
    console.error('CryptoBot withdraw error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/promos/:code/activate', async (req, res) => {
   const code = (req.params.code || '').toUpperCase();
   const userId = req.body?.userId;
   if (!promos[code]) return res.status(404).json({ error: 'Promo not found' });
   if (!activated[userId]) activated[userId] = [];
   if (activated[userId].includes(code)) return res.status(400).json({ error: 'Already activated' });
   activated[userId].push(code);
   // Increment promo uses counter
   if (typeof promos[code] === 'object') {
     promos[code].uses = (promos[code].uses || 0) + 1;
     await savePromoToDB(code, promos[code]);
   }
   var promoAmount = promos[code].amount || promos[code];
   setBalance(userId, getBalance(userId) + promoAmount);
   await applyPromo(userId, promoAmount);
   res.json({ ok: true, amount: promoAmount, balance: getBalance(userId) });
 });

 // === ADMIN: PROMO MANAGEMENT ===

 // List all promos
 app.get('/api/admin/promos', async (req, res) => {
   const { secret } = req.query;
   if (secret !== 'obnul2026') return res.status(403).json({ error: 'Forbidden' });
   const promoList = Object.entries(promos).map(([code, data]) => ({
     code,
     amount: data.amount || data,
     uses: data.uses || 0,
     wager_mult: data.wager_mult || 5
   }));
   res.json({ ok: true, promos: promoList });
 });

 // Create promo
 app.post('/api/admin/promos', async (req, res) => {
   const { secret, code, amount, wager_mult } = req.body;
   if (secret !== 'obnul2026') return res.status(403).json({ error: 'Forbidden' });
   if (!code || !amount) return res.status(400).json({ error: 'Missing code or amount' });
   const upperCode = code.toUpperCase();
   promos[upperCode] = {
     amount: Math.round(parseFloat(amount) * 100) / 100,
     uses: 0,
     wager_mult: parseFloat(wager_mult) || 5
   };
   await savePromoToDB(upperCode, promos[upperCode]);
   saveData();
   res.json({ ok: true, code: upperCode, amount: promos[upperCode].amount });
 });

 // Delete promo
 app.delete('/api/admin/promos/:code', async (req, res) => {
   const { secret } = req.query;
   if (secret !== 'obnul2026') return res.status(403).json({ error: 'Forbidden' });
   const code = req.params.code.toUpperCase();
   if (!promos[code]) return res.status(404).json({ error: 'Promo not found' });
   delete promos[code];
   await deletePromoFromDB(code);
   saveData();
   res.json({ ok: true });
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
        applyBet(uid, totalBet);
       if (win > 0) {
         addTx('win', uid, win, 'completed', { game: 'Wheel', detail: `Won ${win.toFixed(2)} on ${num}` });
       } else {
         addTx('loss', uid, totalBet, 'completed', { game: 'Wheel', detail: `Lost on ${num}` });
         // If balance depleted after loss, reset wager
         if (getBalance(uid) <= 0.001 && (users[uid]?.wager_required || 0) > 0) {
           console.log(`[WAGER] Reset wager for ${uid} after wheel loss — balance depleted ($${getBalance(uid).toFixed(2)})`);
           users[uid].wager_required = 0;
           if (usePostgres) {
             try { db.query('UPDATE users SET wager_required = 0 WHERE id = $1', [uid]); } catch(e) {}
           }
           saveData();
         }
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

function getGameOnlineCounts(){
  let counts = {};
  for(let g in gameOnline) counts[g] = gameOnline[g].size;
  return counts;
}

// === ONLINE PLAYERS TRACKING ===
let onlinePlayers = new Set();
let gameOnline = {}; // { gameName: Set(userId) }

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || '0';
  if(userId && userId !== '0') {
    onlinePlayers.add(userId);
    if (!users[userId]) {
      users[userId] = { balance: 0, wager_required: 0, wager_total: 0, deposit_total: 0, wager_multiplier: 3 };
      dbSetUser(userId, users[userId]);
    }
  }
  io.emit('online_count', { count: onlinePlayers.size, games: getGameOnlineCounts() });

  // Player joins a game
  socket.on('join_game', (game) => {
    if(!game || !userId || userId === '0') return;
    if(!gameOnline[game]) gameOnline[game] = new Set();
    gameOnline[game].add(userId);
    io.emit('online_count', { count: onlinePlayers.size, games: getGameOnlineCounts() });
  });

  // Player leaves a game
  socket.on('leave_game', (game) => {
    if(!game || !userId || userId === '0') return;
    if(gameOnline[game]) gameOnline[game].delete(userId);
    io.emit('online_count', { count: onlinePlayers.size, games: getGameOnlineCounts() });
  });

  socket.on('disconnect', () => {
    if(userId && userId !== '0') {
      onlinePlayers.delete(userId);
      // Remove from all games
      for(let g in gameOnline) gameOnline[g].delete(userId);
      io.emit('online_count', { count: onlinePlayers.size, games: getGameOnlineCounts() });
    }
  });

  socket.on('get_online', () => {
    socket.emit('online_count', { count: onlinePlayers.size, games: getGameOnlineCounts() });
  });

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
     applyBet(userId, amount);
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

// === TELEGRAM BOT ===
const BOT_TOKEN = process.env.BOT_TOKEN || '8962248830:AAEoWT12lZEzttXXHxt3c48wLGh5HcZ6FoQ';
const CHANNEL_ID = '@milfacasino';
const SUB_REWARD = 0.3;

// Helper: fetch with timeout
function fetchWithTimeout(url, opts, ms) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function(){ reject(new Error('timeout')); }, ms);
    fetch(url, opts).then(function(res){ clearTimeout(timer); resolve(res); }, function(err){ clearTimeout(timer); reject(err); });
  });
}

// Check Telegram subscription
app.get('/api/check-subscribe/:userId', async (req, res) => {
  if (!BOT_TOKEN) return res.json({ subscribed: false, error: 'no_bot' });
  const userId = String(req.params.userId);
  console.log('[SUB CHECK] userId:', userId, 'token present:', !!BOT_TOKEN);
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`;
    const chatMemberRes = await fetchWithTimeout(url, {}, 5000);
    const data = await chatMemberRes.json();
    console.log('[SUB CHECK] TG API response:', JSON.stringify(data));
    if (!data.ok) { console.log('[SUB CHECK] not ok'); return res.json({ subscribed: false }); }
    const status = data.result?.status;
    const subscribed = ['member', 'administrator', 'creator'].includes(status);
    console.log('[SUB CHECK] status:', status, 'subscribed:', subscribed);
    res.json({ subscribed, status });
  } catch (e) {
    console.error('[SUB CHECK] error:', e.message);
    res.json({ subscribed: false });
  }
});

// Claim subscribe reward (server-side check + DB + memory)
app.post('/api/bonus/subscribe', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  // 1. Verify subscription via Telegram API
  try {
    const chatMemberRes = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`, {}, 5000);
    const data = await chatMemberRes.json();
    if (!data.ok || !['member', 'administrator', 'creator'].includes(data.result?.status)) {
      return res.status(403).json({ error: 'not_subscribed' });
    }
  } catch (e) {
    console.error('Subscribe verify error:', e.message);
    return res.status(500).json({ error: 'check_failed' });
  }

  // 2. Check if already claimed — DB first, then memory
  if (!users[userId]) users[userId] = { balance: 0, subClaimed: false };

  if (usePostgres) {
    try {
      // Insert user if not exists
      await db.query(`INSERT INTO users (id, balance, sub_claimed) VALUES ($1, $2, false) ON CONFLICT (id) DO NOTHING`, [userId, users[userId].balance]);
      // Check sub_claimed
      const result = await db.query('SELECT sub_claimed FROM users WHERE id = $1', [userId]);
      if (result.rows[0]?.sub_claimed === true) {
        return res.status(400).json({ error: 'already_claimed' });
      }
    } catch(e) { console.error('DB check error:', e.message); }
  }

  if (users[userId].subClaimed) return res.status(400).json({ error: 'already_claimed' });

  // 3. Give reward
  users[userId].balance = Math.round((users[userId].balance + SUB_REWARD) * 100) / 100;
  users[userId].subClaimed = true;
  io.emit('balance_update', { userId, balance: users[userId].balance });

  // 4. Persist everywhere
  if (usePostgres) {
    try {
      await db.query('UPDATE users SET balance = $1, sub_claimed = true WHERE id = $2', [users[userId].balance, userId]);
    } catch(e) { console.error('DB save error:', e.message); }
  }
  saveData();

  console.log(`💰 Sub reward: user ${userId} +$${SUB_REWARD}, balance: ${users[userId].balance}`);
  res.json({ ok: true, balance: users[userId].balance });
});

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

 async function startServer() {
   if (usePostgres) {
     try {
       // Create all tables with await — MUST complete before loading users
       await db.query(`
         CREATE TABLE IF NOT EXISTS users (
           id TEXT PRIMARY KEY,
           balance REAL DEFAULT 0,
           bonus_balance REAL DEFAULT 0,
           wager_required REAL DEFAULT 0,
           wager_total REAL DEFAULT 0,
           deposit_total REAL DEFAULT 0,
           wager_multiplier REAL DEFAULT 3,
           first_name TEXT,
           last_name TEXT,
           username TEXT,
           avatar TEXT,
           sub_claimed BOOLEAN DEFAULT FALSE,
           created_at TIMESTAMP DEFAULT NOW()
         )
       `);
       console.log('✅ users table ready');

       await db.query(`
         CREATE TABLE IF NOT EXISTS promos (
           code TEXT PRIMARY KEY,
           amount REAL DEFAULT 0,
           uses INTEGER DEFAULT 0,
           wager_mult REAL DEFAULT 5
         )
       `);

       await db.query(`
         CREATE TABLE IF NOT EXISTS activated (
           user_id TEXT,
           code TEXT,
           activated_at TIMESTAMP DEFAULT NOW(),
           PRIMARY KEY (user_id, code)
         )
       `);

       await db.query(`
         CREATE TABLE IF NOT EXISTS paid_invoices (
           provider TEXT,
           invoice_id TEXT,
           user_id TEXT,
           amount REAL,
           time BIGINT,
           PRIMARY KEY (provider, invoice_id)
         )
       `);
       console.log('✅ All tables ready');

       // Load users and promos from PG
       await loadUsersFromPG();
       await loadPromosFromPG();
       console.log('🐘 Startup complete — users:', Object.keys(users).length, 'promos:', Object.keys(promos).length);
     } catch(e) {
       console.error('❌ Startup DB error:', e.message);
       console.error('❌ Data may be lost!');
     }
   } else {
     console.log('📂 PostgreSQL not configured — using file storage (data lost on restart)');
   }
   server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
 }
  startServer();

 // Graceful shutdown — save all users to DB before exit
 async function gracefulShutdown(signal) {
   console.log(`\n⚠️  Received ${signal} — saving all users to DB...`);
   if (usePostgres && Object.keys(users).length > 0) {
     try {
       for (const id in users) {
         const u = users[id];
         await db.query(`
           INSERT INTO users (id, balance, bonus_balance, wager_required, wager_total, deposit_total, wager_multiplier, first_name, last_name, username, avatar, sub_claimed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             balance = EXCLUDED.balance,
             bonus_balance = EXCLUDED.bonus_balance,
             wager_required = EXCLUDED.wager_required,
             wager_total = EXCLUDED.wager_total,
             deposit_total = EXCLUDED.deposit_total,
             wager_multiplier = EXCLUDED.wager_multiplier,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             username = EXCLUDED.username,
             avatar = EXCLUDED.avatar,
             sub_claimed = EXCLUDED.sub_claimed
         `, [id, u.balance||0, u.bonus_balance||0, u.wager_required||0, u.wager_total||0, u.deposit_total||0, u.wager_multiplier||3, u.first_name||null, u.last_name||null, u.username||null, u.avatar||null, u.sub_claimed||false]);
       }
       console.log(`✅ Saved ${Object.keys(users).length} users to DB`);
     } catch(e) {
       console.error('❌ Shutdown save error:', e.message);
     }
   }
   saveData();
   process.exit(0);
 }

 process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
 process.on('SIGINT', () => gracefulShutdown('SIGINT'));

 // Periodic auto-save every 60 seconds
 if (usePostgres) {
   setInterval(async () => {
     if (Object.keys(users).length === 0) return;
     try {
       for (const id in users) {
         const u = users[id];
         await db.query(`
           INSERT INTO users (id, balance, bonus_balance, wager_required, wager_total, deposit_total, wager_multiplier, first_name, last_name, username, avatar, sub_claimed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             balance = EXCLUDED.balance,
             bonus_balance = EXCLUDED.bonus_balance,
             wager_required = EXCLUDED.wager_required,
             wager_total = EXCLUDED.wager_total,
             deposit_total = EXCLUDED.deposit_total,
             wager_multiplier = EXCLUDED.wager_multiplier,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             username = EXCLUDED.username,
             avatar = EXCLUDED.avatar,
             sub_claimed = EXCLUDED.sub_claimed
         `, [id, u.balance||0, u.bonus_balance||0, u.wager_required||0, u.wager_total||0, u.deposit_total||0, u.wager_multiplier||3, u.first_name||null, u.last_name||null, u.username||null, u.avatar||null, u.sub_claimed||false]);
       }
       console.log(`💾 Auto-save: ${Object.keys(users).length} users synced to DB`);
     } catch(e) {
       console.error('❌ Auto-save error:', e.message);
     }
   }, 60000);
 }

// Bot disabled — run separately via bot.js
// Set SERVER_URL env var on Railway for bot to work
