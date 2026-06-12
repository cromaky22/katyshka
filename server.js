const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(__dirname));

// === GET USER BALANCE ===
app.get('/api/users', (req, res) => {
  const id = req.query.id;
  if (id) return res.json({ ok: true, balance: getBalance(id) });
  const userList = [];
  for (const uid in users) userList.push({ id: uid, ...users[uid] });
  res.json(userList);
});

app.post('/api/users', (req, res) => {
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
  saveData();
  res.json({ ok: true, balance: users[id].balance });
});

// === DATABASE (in-memory with file persistence) ===
const fs = require('fs');
const DATA_FILE = './data.json';

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

// Load data from file on start
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



// Save data to file
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users, promos, activated, transactions }));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

function getBalance(id) { return users[id]?.balance || 0; }
function setBalance(id, amt) {
  if (!users[id]) users[id] = { balance: 0 };
  users[id].balance = Math.round(amt * 100) / 100;
  saveData();
}

// Add transaction to history
function addTx(type, userId, amount, status, extra) {
  transactions.push({
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    type,
    userId,
    amount: Math.round(amount * 100) / 100,
    status,
    date: new Date().toISOString(),
    ...extra
  });
  saveData();
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



// === ADMIN: SET USER BALANCE ===
app.put('/api/users/:id/balance', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { balance } = req.body;
  if (!users[id]) users[id] = { balance: 0 };
  users[id].balance = Math.round(parseFloat(balance) * 100) / 100;
  saveData();
  res.json({ ok: true, balance: users[id].balance });
});

// === ADMIN: GET ALL PROMOS ===
app.get('/api/promos', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const promoList = [];
  for (const code in promos) {
    promoList.push({ code, amount: promos[code], uses: 0 });
  }
  res.json(promoList);
});

// === ADMIN: ADD PROMO ===
app.post('/api/promos', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const { code, amount, maxUses } = req.body;
  if (!code || !amount) return res.status(400).json({ error: 'Missing code or amount' });
  promos[code.toUpperCase()] = parseFloat(amount);
  saveData();
  res.json({ ok: true });
});

// === ADMIN: DELETE PROMO ===
app.delete('/api/promos/:code', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  delete promos[req.params.code.toUpperCase()];
  saveData();
  res.json({ ok: true });
});
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'obnul2026';

app.post('/api/admin/obnul', (req, res) => {
  const { secret } = req.body || {};
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  // Clear all user balances
  for (const uid in users) {
    users[uid].balance = 0;
  }
  // Clear wheel bets
  wheel.bets = {};
  // Clear activated promos
  for (const uid in activated) {
    activated[uid] = [];
  }
  // Notify all connected clients to reset
  io.emit('admin:obnul');
  console.log('🔄 OBNUL executed — all balances, bets, promos reset');
  res.json({ ok: true, message: 'All balances, bets, promos reset to 0' });
});

// === ADMIN: GIVE BALANCE ===
app.post('/api/admin/give', (req, res) => {
  const { secret, userId, amount } = req.body || {};
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  if (!userId || !amount) return res.status(400).json({ error: 'Missing userId or amount' });
  const amt = Math.round(parseFloat(amount) * 100) / 100;
  if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  setBalance(userId, getBalance(userId) + amt);
  console.log(`💰 Gave $${amt} to ${userId}, new balance: $${getBalance(userId)}`);
  io.emit('balance_update', { userId, balance: getBalance(userId) });
  res.json({ ok: true, balance: getBalance(userId) });
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
    wheel.bets[uid].forEach(b => { if (betWins(b.type, num)) win += b.amount * getCoef(b.type); });
    win = Math.round(win * 100) / 100;
    results[uid] = win;
    setBalance(uid, getBalance(uid) + win);
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

// Start bot if BOT_TOKEN is set
if(process.env.BOT_TOKEN){
  try {
    const { Telegraf } = require('telegraf');
    const bot = new Telegraf(process.env.BOT_TOKEN);
    
    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'obnul2026';
    const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
    
    // Admin sessions
    const adminSessions = new Map();
    
    function isAdmin(ctx) {
      const s = adminSessions.get(ctx.from.id);
      return s && s.authenticated;
    }
    
    function mainMenuText() {
      return '🎛 **Админ-панель KATYSHKA**\n\nВыберите действие:';
    }
    
    function mainMenuKeyboard() {
      return {
        inline_keyboard: [
          [{ text: '📊 Статистика', callback_data: 'admin:stats' }, { text: '👥 Пользователи', callback_data: 'admin:users' }],
          [{ text: '💰 Выдать баланс', callback_data: 'admin:give' }, { text: '💸 Списать баланс', callback_data: 'admin:take' }],
          [{ text: '⚡ Установить баланс', callback_data: 'admin:set' }, { text: '🔍 Найти юзера', callback_data: 'admin:find' }],
          [{ text: '💰➕ Пополнить себе', callback_data: 'admin:addme' }],
          [{ text: '🗑 Обнулить ВСЁ', callback_data: 'admin:obnul' }],
          [{ text: '🔓 Выйти', callback_data: 'admin:logout' }]
        ]
      };
    }
    
    function backKeyboard() {
      return { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] };
    }
    
    async function sendToServer(path, body) {
      try {
        const res = await fetch(`${SERVER_URL}/api${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        return await res.json();
      } catch (e) {
        return { error: 'connection' };
      }
    }
    
    async function getFromServer(path) {
      try {
        const res = await fetch(`${SERVER_URL}/api${path}`);
        return await res.json();
      } catch (e) {
        return null;
      }
    }
    
    // START
    bot.start(async (ctx) => {
      const userId = ctx.from.id;
      // Check if user is admin (first user or has password)
      adminSessions.set(userId, { authenticated: true, state: 'idle' });
      await ctx.reply(mainMenuText(), {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard()
      });
    });
    
    // TEXT HANDLER
    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      const userId = ctx.from.id;
      const session = adminSessions.get(userId);
      
      if (!session || !session.authenticated) {
        if (text === ADMIN_SECRET) {
          adminSessions.set(userId, { authenticated: true, state: 'idle' });
          return ctx.reply('✅ Доступ разрешён!', { reply_markup: mainMenuKeyboard() });
        }
        return ctx.reply('🔐 Введите пароль для доступа к админ-панели.');
      }
      
      // Handle states
      if (session.state === 'give_id') {
        session.targetId = text.trim();
        session.state = 'give_amount';
        return ctx.reply(`💰 Введите сумму для выдачи пользователю ${session.targetId}:`);
      }
      
      if (session.state === 'give_amount') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Неверная сумма.');
        const data = await sendToServer('/users', { id: session.targetId, balance: amount });
        session.state = 'idle';
        if (data.ok) {
          return ctx.reply(`✅ Выдано $${amount.toFixed(2)} пользователю ${session.targetId}\nТекущий баланс: $${data.balance.toFixed(2)}`, { reply_markup: backKeyboard() });
        }
        return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`);
      }
      
      if (session.state === 'take_id') {
        session.targetId = text.trim();
        session.state = 'take_amount';
        return ctx.reply(`💸 Введите сумму для списания у пользователя ${session.targetId}:`);
      }
      
      if (session.state === 'take_amount') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Неверная сумма.');
        const userData = await getFromServer(`/users?id=${session.targetId}`);
        const currentBalance = userData?.balance || 0;
        const newBalance = Math.max(0, currentBalance - amount);
        const data = await sendToServer('/users', { id: session.targetId, balance: newBalance });
        session.state = 'idle';
        if (data.ok) {
          return ctx.reply(`💸 Списано $${amount.toFixed(2)} у ${session.targetId}\nБыло: $${currentBalance.toFixed(2)}\nТекущий: $${data.balance.toFixed(2)}`, { reply_markup: backKeyboard() });
        }
        return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`);
      }
      
      if (session.state === 'set_id') {
        session.targetId = text.trim();
        session.state = 'set_amount';
        return ctx.reply(`⚡ Введите новый баланс для пользователя ${session.targetId}:`);
      }
      
      if (session.state === 'set_amount') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount < 0) return ctx.reply('❌ Неверная сумма.');
        const data = await sendToServer('/users', { id: session.targetId, balance: amount });
        session.state = 'idle';
        if (data.ok) {
          return ctx.reply(`⚡ Баланс ${session.targetId} установлен: $${amount.toFixed(2)}`, { reply_markup: backKeyboard() });
        }
        return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`);
      }
      
      if (session.state === 'find_id') {
        const targetId = text.trim();
        const data = await getFromServer(`/users?id=${targetId}`);
        session.state = 'idle';
        if (data && data.balance !== undefined) {
          const name = data.first_name || data.username || targetId;
          const bal = (data.balance || 0).toFixed(2);
          return ctx.reply(`👤 **Пользователь**\n\n🆔 ID: \`${targetId}\`\n📛 Имя: ${name}\n💰 Баланс: $${bal}`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 Выдать', callback_data: `admin:quick_give:${targetId}` }, { text: '💸 Списать', callback_data: `admin:quick_take:${targetId}` }],
                [{ text: '🔙 Назад', callback_data: 'admin:back' }]
              ]
            }
          });
        }
        return ctx.reply(`❌ Пользователь ${targetId} не найден.`);
      }
      
      if (session.state === 'addme_amount') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Неверная сумма.');
        const myId = String(userId);
        const userData = await getFromServer(`/users?id=${myId}`);
        const currentBalance = userData?.balance || 0;
        const newBalance = currentBalance + amount;
        const data = await sendToServer('/users', { id: myId, balance: newBalance });
        session.state = 'idle';
        if (data.ok) {
          return ctx.reply(`💰✅ Баланс пополнен!\n\nБыло: $${currentBalance.toFixed(2)}\nДобавлено: $${amount.toFixed(2)}\nИтого: $${data.balance.toFixed(2)}`, { reply_markup: backKeyboard() });
        }
        return ctx.reply(`❌ Ошибка: ${data.error}`);
      }
    });
    
    // CALLBACK HANDLER
    bot.on('callback_query', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const userId = ctx.from.id;
      
      if (!data.startsWith('admin:')) return;
      
      const session = adminSessions.get(userId);
      if (!session || !session.authenticated) {
        return ctx.answerCbQuery('🔐 Введите пароль.');
      }
      
      if (data.startsWith('admin:quick_give:')) {
        const targetId = data.split(':')[2];
        session.state = 'give_amount';
        session.targetId = targetId;
        await ctx.answerCbQuery();
        return ctx.reply(`💰 Введите сумму для выдачи пользователю ${targetId}:`);
      }
      
      if (data.startsWith('admin:quick_take:')) {
        const targetId = data.split(':')[2];
        session.state = 'take_amount';
        session.targetId = targetId;
        await ctx.answerCbQuery();
        return ctx.reply(`💸 Введите сумму для списания у пользователя ${targetId}:`);
      }
      
      if (data === 'admin:stats') {
        const users = await getFromServer('/users');
        const totalUsers = Array.isArray(users) ? users.length : 0;
        const totalBalance = Array.isArray(users) ? users.reduce((s, u) => s + (u.balance || 0), 0).toFixed(2) : '0.00';
        await ctx.editMessageText(`📊 **Статистика**\n\n👥 Пользователей: ${totalUsers}\n💰 Общий баланс: $${totalBalance}`, {
          parse_mode: 'Markdown',
          reply_markup: backKeyboard()
        });
        return ctx.answerCbQuery();
      }
      
      if (data === 'admin:users') {
        const users = await getFromServer('/users');
        if (!Array.isArray(users) || users.length === 0) {
          await ctx.editMessageText('Пользователей пока нет.', { reply_markup: backKeyboard() });
        } else {
          let msg = `👥 **Пользователи (${users.length}):**\n\n`;
          const buttons = [];
          users.forEach(u => {
            const name = ((u.first_name || '') + (u.last_name ? ' ' + u.last_name : '')).trim() || u.username || u.id;
            const bal = (u.balance != null) ? Number(u.balance).toFixed(2) : '0.00';
            msg += `• \`${u.id}\` — ${name} — $${bal}\n`;
            buttons.push([{ text: `👤 ${name} ($${bal})`, callback_data: `admin:user:${u.id}` }]);
          });
          buttons.push([{ text: '🔙 Назад', callback_data: 'admin:back' }]);
          await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
        }
        return ctx.answerCbQuery();
      }
      
      if (data.startsWith('admin:user:')) {
        const targetId = data.split(':')[2];
        const u = await getFromServer(`/users?id=${targetId}`);
        const name = u?.first_name || u?.username || targetId;
        const bal = (u?.balance || 0).toFixed(2);
        await ctx.editMessageText(`👤 **${name}**\n🆔 \`${targetId}\`\n💰 Баланс: $${bal}`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Выдать', callback_data: `admin:quick_give:${targetId}` }, { text: '💸 Списать', callback_data: `admin:quick_take:${targetId}` }],
              [{ text: '⚡ Установить', callback_data: `admin:quick_set:${targetId}` }],
              [{ text: '🔙 Назад', callback_data: 'admin:users' }]
            ]
          }
        });
        return ctx.answerCbQuery();
      }
      
      if (data.startsWith('admin:quick_set:')) {
        const targetId = data.split(':')[2];
        session.state = 'set_amount';
        session.targetId = targetId;
        await ctx.answerCbQuery();
        return ctx.reply(`⚡ Введите новый баланс для ${targetId}:`);
      }
      
      if (data === 'admin:give') {
        session.state = 'give_id';
        await ctx.answerCbQuery();
        return ctx.reply('💰 Введите ID пользователя:');
      }
      
      if (data === 'admin:take') {
        session.state = 'take_id';
        await ctx.answerCbQuery();
        return ctx.reply('💸 Введите ID пользователя:');
      }
      
      if (data === 'admin:set') {
        session.state = 'set_id';
        await ctx.answerCbQuery();
        return ctx.reply('⚡ Введите ID пользователя:');
      }
      
      if (data === 'admin:find') {
        session.state = 'find_id';
        await ctx.answerCbQuery();
        return ctx.reply('🔍 Введите ID пользователя для поиска:');
      }
      
      if (data === 'admin:addme') {
        session.state = 'addme_amount';
        await ctx.answerCbQuery();
        return ctx.reply(`💰➕ Введите сумму для пополнения вашего баланса (ID: ${userId}):`);
      }
      
      if (data === 'admin:obnul') {
        await ctx.editMessageText('🗑 **Вы уверены?** Это обнулит ВСЕ балансы, ставки и промокоды!', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Да, обнулить всё', callback_data: 'admin:obnul_confirm' }],
              [{ text: '❌ Отмена', callback_data: 'admin:back' }]
            ]
          }
        });
        return ctx.answerCbQuery();
      }
      
      if (data === 'admin:obnul_confirm') {
        const result = await sendToServer('/admin/obnul', { secret: ADMIN_SECRET });
        if (result.ok) {
          await ctx.editMessageText('✅ Всё обнулено!', { reply_markup: backKeyboard() });
        } else {
          await ctx.editMessageText(`❌ Ошибка: ${result.error}`, { reply_markup: backKeyboard() });
        }
        return ctx.answerCbQuery();
      }
      
      if (data === 'admin:back') {
        session.state = 'idle';
        await ctx.answerCbQuery();
        try { await ctx.deleteMessage(); } catch(e) {}
        return ctx.reply(mainMenuText(), { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() });
      }
      
      if (data === 'admin:logout') {
        session.authenticated = false;
        session.state = 'idle';
        await ctx.editMessageText('🚪 Вы вышли. Введите пароль для повторного входа.');
        return ctx.answerCbQuery();
      }
    });
    
    bot.launch().then(() => console.log('🤖 Admin bot started'));
    console.log('🤖 Admin bot initialized');
  } catch (e) {
    console.error('Bot init error:', e.message);
  }
}
