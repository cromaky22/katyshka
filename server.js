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

function getBalance(id) { return users[id]?.balance || 100; }
function setBalance(id, amt) {
  if (!users[id]) users[id] = { balance: 100 };
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
const XROCKET_URL = 'https://pay.xrocket.tg/api';

async function xrocket(method, params) {
  const headers = { 'Content-Type': 'application/json' };
  // xRocket uses token in URL or header
  const url = `${XROCKET_URL}/${method}`;
  
  const res = await fetch(url, {
    method: params ? 'POST' : 'GET',
    headers: { ...headers, 'Authorization': `Bearer ${XROCKET_KEY}` },
    body: params ? JSON.stringify(params) : undefined
  });
  return res.json();
}

// Create xRocket invoice
app.post('/api/invoice/xrocket', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount < 0.1) {
      return res.status(400).json({ error: 'Min amount: $0.1' });
    }

    const result = await xrocket('invoice', {
      amount: String(Number(amount).toFixed(2)),
      currency: 'TONCOIN',
      description: `Deposit for ${userId}`,
      payload: JSON.stringify({ userId }),
      expiredIn: 1800
    });

    console.log('xRocket response:', JSON.stringify(result));

    // xRocket returns data in different format
    if (result.ok || result.data || result.invoice_id) {
      const invoice = result.data || result;
      addTx('deposit', userId, Number(amount), 'pending', { provider: 'xrocket', invoiceId: invoice.invoice_id || invoice.id });
      res.json({
        ok: true,
        invoiceId: invoice.invoice_id || invoice.id,
        payUrl: invoice.pay_url || invoice.bot_invoice_url || invoice.mini_app_invoice_url
      });
    } else {
      res.status(500).json({ error: result.error || result.message || 'Failed' });
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

    const result = await xrocket(`invoice/${invoiceId}`);
    console.log('xRocket check:', JSON.stringify(result));

    if (result.ok || result.data) {
      const inv = result.data || result;
      if (inv.status === 'paid' || inv.status === 'completed') {
        try {
          const payload = JSON.parse(inv.payload || '{}');
          if (payload.userId) {
            setBalance(payload.userId, getBalance(payload.userId) + parseFloat(inv.amount));
            // Update transaction status
            const tx = transactions.find(t => t.invoiceId === invoiceId);
            if (tx) tx.status = 'completed';
          }
        } catch (e) {}
      }
      res.json({ ok: true, status: inv.status, amount: inv.amount });
    } else {
      res.json({ ok: true, status: 'not_found' });
    }
  } catch (e) {
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
    wheel.bets[uid].forEach(b => { if (betWins(b.type, num)) win += b.amount * getCoef(b.type); });
    win = Math.round(win * 100) / 100;
    results[uid] = win;
    if (win > 0) setBalance(uid, getBalance(uid) + win);
  }

  wheel.result = { num, color, index: idx };
  wheel.history.unshift({ num, color });
  if (wheel.history.length > 20) wheel.history.pop();

  io.emit('wheel:spin', { result: wheel.result, allBets, results, history: wheel.history });

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
  socket.emit('wheel:state', { phase: wheel.phase, timer: wheel.timer, myBets: wheel.bets[userId] || [] });

  socket.on('wheel:bet', (data) => {
    if (wheel.phase !== 'betting') return;
    const { type, amount, playerName } = data;
    if (!type || !amount || amount <= 0) return;
    const total = (wheel.bets[userId] || []).reduce((s, b) => s + b.amount, 0);
    if (total + amount > getBalance(userId)) return;
    if (!wheel.bets[userId]) wheel.bets[userId] = [];
    wheel.bets[userId].push({ type, amount, playerName: playerName || 'Player' });
    setBalance(userId, getBalance(userId) - amount);
    const allBets = [];
    for (const uid in wheel.bets) {
      wheel.bets[uid].forEach(b => allBets.push({ userId: uid, type: b.type, amount: b.amount, playerName: b.playerName }));
    }
    io.emit('wheel:betsUpdate', { allBets, myBets: wheel.bets[userId] || [] });
  });
});

startWheel();

// === START ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
