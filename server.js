const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(__dirname));

// === DATABASE (in-memory) ===
const users = {};
const promos = { '1': 200, '2': 200, '3': 200, '4': 200, '5': 200, '6': 200 };
const activated = {};
const transactions = []; // History of all transactions

function getBalance(id) { return users[id]?.balance || 0; }
function setBalance(id, amt) {
  if (!users[id]) users[id] = { balance: 0 };
  users[id].balance = Math.round(amt * 100) / 100;
}

// Add transaction to history
function addTx(type, userId, amount, status, extra) {
  transactions.push({
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    type, // 'deposit' or 'withdraw'
    userId,
    amount: Math.round(amount * 100) / 100,
    status, // 'pending', 'completed', 'failed'
    date: new Date().toISOString(),
    ...extra
  });
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
      currency: 'TON',
      comment: 'Katyshka withdraw'
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

// === GET ALL USERS (admin) ===
app.get('/api/users', (req, res) => {
  const userList = [];
  for (const id in users) {
    userList.push({ id, ...users[id] });
  }
  res.json(userList);
});

// === ADMIN: OBNUL (обнуление всех балансов и ставок) ===
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
    if (win > 0) setBalance(uid, getBalance(uid) + win);
  }

  wheel.result = { num, color, index: idx };
  wheel.history.unshift({ num, color });
  if (wheel.history.length > 20) wheel.history.pop();

  const balances = {};
  for (const uid in wheel.bets) { balances[uid] = getBalance(uid); }
  io.emit('wheel:spin', { result: wheel.result, allBets, results, history: wheel.history, balances });

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
  const clientBalance = parseFloat(socket.handshake.query.balance) || 0;
  if (!users[userId]) {
    users[userId] = { balance: clientBalance };
  }
  socket.emit('wheel:state', { phase: wheel.phase, timer: wheel.timer, myBets: wheel.bets[userId] || [], balance: getBalance(userId), history: wheel.history });

  socket.on('wheel:bet', (data) => {
    if (wheel.phase !== 'betting') return;
    const { type, amount, playerName, playerAvatar } = data;
    if (!type || !amount || amount <= 0) return;
    const total = (wheel.bets[userId] || []).reduce((s, b) => s + b.amount, 0);
    if (total + amount > getBalance(userId)) return;
    if (!wheel.bets[userId]) wheel.bets[userId] = [];
    wheel.bets[userId].push({ type, amount, playerName: playerName || 'Player', playerAvatar: playerAvatar || '' });
    setBalance(userId, getBalance(userId) - amount);
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
