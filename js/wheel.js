document.addEventListener('DOMContentLoaded', function(){
  // === STATS HELPER ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      const data = {userId, type, amount: Math.abs(amount), detail: detail || 'Wheel'};
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      }).catch(function(){});
    }catch(e){}
  }
  
  const canvas = document.getElementById('wheelCanvas');
  const ctx = canvas.getContext('2d');
  const resultLens = document.getElementById('resultLens');
  const stakeInput = document.getElementById('stakeInput');
  const gameStatusEl = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const betBtns = document.querySelectorAll('.bet-btn[data-bet]');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  const numbersToggle = document.getElementById('toggleNumbersBtn');
  const numbersBack = document.getElementById('toggleDefaultBtn');
  const bettingTable = document.getElementById('bettingTable');
  const numbersTable = document.getElementById('numbersTable');
  const numbersGrid = document.getElementById('numbersGrid');
  const activeBets = document.getElementById('activeBets');
  const activeBetsList = document.getElementById('activeBetsList');
  const timerValueEl = document.getElementById('timerValue');
  const allPlayersBetsEl = document.getElementById('allPlayersBets');
  const allPlayersBetsList = document.getElementById('allPlayersBetsList');

  const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  function isRed(n) { return RED_NUMBERS.indexOf(n) !== -1; }

  const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const TOTAL = WHEEL_NUMBERS.length;
  const SEG_ANGLE = 360 / TOTAL;

  const SEGMENTS = WHEEL_NUMBERS.map(n => ({
    num: n,
    color: n === 0 ? '#8bc34a' : (isRed(n) ? '#f44336' : '#101010'),
    label: String(n)
  }));

  let rotation = 0;
  let audioCtx = null;
  let currentBets = [];
  let playerName = 'Player';
  let playerAvatar = '';
  let isSpinning = false;
  let localTimer = null;

  let canvasSize = 600;

  function setupCanvas() {
    const wrapper = document.getElementById('wheelWrapper');
    if (!wrapper) return;
    const size = wrapper.offsetWidth;
    if (size < 50) return;
    canvasSize = size * 2;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    drawWheel();
  }

  const CX = () => canvas.width / 2;
  const CY = () => canvas.height / 2;
  const R = () => canvas.width / 2 - 4;

  function drawWheel() {
    const cx = CX(), cy = CY(), r = R();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < TOTAL; i++) {
      const seg = SEGMENTS[i];
      const startAngle = (i * SEG_ANGLE - 90 + rotation) * Math.PI / 180;
      const endAngle = ((i + 1) * SEG_ANGLE - 90 + rotation) * Math.PI / 180;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, startAngle, endAngle); ctx.closePath();
      ctx.fillStyle = seg.color; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((startAngle + endAngle) / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(r * 0.09)}px Arial`; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3;
      ctx.fillText(seg.label, r * 0.72, 0); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2); ctx.fillStyle = '#1a1a2e'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 3; ctx.stroke();
  }
  setupCanvas();
  window.addEventListener('resize', setupCanvas);

  function initAudio() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  }
  function tone(freq, type, dur, vol) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(vol, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(g).connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function tickSfx() { tone(600 + Math.random() * 300, 'sine', 0.04, 0.03); }
  function winSfx() { tone(800, 'square', 0.1, 0.05); setTimeout(() => tone(1200, 'sine', 0.15, 0.04), 100); }
  function loseSfx() { tone(100, 'sawtooth', 0.3, 0.04); }

  function getBetLabel(type) {
    const map = { red: 'Красное', black: 'Черное', odd: 'Чётное', notodd: 'Нечётное', range1: '1-18', range2: '19-36', range3: '1-12', range4: '13-24', range5: '25-36', '0': '0' };
    return map[type] || (isNaN(type) ? type : '№' + type);
  }
  function getBetColor(type) {
    if (type === 'red') return '#f44336';
    if (type === 'black') return '#333';
    if (type === 'odd') return '#009688';
    if (type === 'notodd') return '#607d8b';
    if (type === '0') return '#8bc34a';
    if (type.indexOf('range') === 0) return '#3f51b5';
    const n = Number(type);
    return !isNaN(n) ? (isRed(n) ? '#f44336' : '#333') : '#666';
  }
  function getBetCoef(type) {
    if (type === '0' || !isNaN(Number(type))) return 36;
    if (type === 'range3' || type === 'range4' || type === 'range5') return 3;
    return 2;
  }
  function betWins(betType, resultNum) {
    if (betType === '0') return resultNum === 0;
    if (betType === 'red') return isRed(resultNum);
    if (betType === 'black') return resultNum > 0 && !isRed(resultNum);
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

  const BET_GROUPS = { color: ['red', 'black'], parity: ['odd', 'notodd'] };
  function getBetGroup(type) {
    for (const g in BET_GROUPS) { if (BET_GROUPS[g].indexOf(type) !== -1) return g; }
    return null;
  }

  function updateMyBetsDisplay() {
    if (currentBets.length === 0) { activeBets.style.display = 'none'; return; }
    activeBets.style.display = 'flex';
    activeBetsList.innerHTML = '';
    const grouped = {};
    currentBets.forEach((bet, i) => {
      if (!grouped[bet.type]) grouped[bet.type] = { type: bet.type, amount: 0 };
      grouped[bet.type].amount += bet.amount;
    });
    Object.values(grouped).forEach((group) => {
      const el = document.createElement('div');
      el.className = 'active-bet-item';
      el.style.background = getBetColor(group.type);
      el.innerHTML = `<span>${getBetLabel(group.type)}</span><span>$${group.amount.toFixed(2)}</span>`;
      activeBetsList.appendChild(el);
    });
  }

  function addBet(type) {
    if (isSpinning) return;
    const stake = parseFloat(stakeInput.value) || 0;
    if (stake < 0.1) { gameStatusEl.textContent = 'Мин. ставка $0.10'; gameStatusEl.className = 'game-status error'; return; }
    if (stake > 200) { gameStatusEl.textContent = 'Макс. ставка $200'; gameStatusEl.className = 'game-status error'; return; }
    const totalCurrent = currentBets.reduce((s, b) => s + b.amount, 0);
    if (totalCurrent + stake > Balance.get()) { gameStatusEl.textContent = 'Недостаточно средств'; gameStatusEl.className = 'game-status error'; return; }
    const group = getBetGroup(type);
    if (group) {
      const existing = currentBets.find(b => getBetGroup(b.type) === group);
      if (existing && existing.type !== type) {
        const labels = { color: 'цвет', parity: 'чётность' };
        gameStatusEl.textContent = `Только один ${labels[group]}`;
        gameStatusEl.className = 'game-status error';
        return;
      }
    }
    currentBets.push({ type, amount: stake });
    updateMyBetsDisplay();
    gameStatusEl.textContent = '';
    recordStat('bet', stake, `Wheel ${getBetLabel(type)}`);
    if(window.mcStats) mcStats.addBet(stake, 'Wheel', getBetLabel(type));
    socket.emit('wheel:bet', { type, amount: stake, playerName, playerAvatar });
  }

  function updateAllPlayersBets(allBets) {
    if (!allBets || allBets.length === 0) { allPlayersBetsEl.style.display = 'none'; return; }
    allPlayersBetsEl.style.display = 'flex';
    allPlayersBetsList.innerHTML = '';
    const grouped = {};
    allBets.forEach(bet => {
      const key = (bet.playerName||'Player') + '|' + bet.type;
      if (!grouped[key]) grouped[key] = { playerName: bet.playerName||'Player', type: bet.type, amount: 0, playerAvatar: bet.playerAvatar || '' };
      grouped[key].amount += bet.amount;
    });
    Object.values(grouped).forEach(g => {
      const el = document.createElement('div');
      el.className = 'player-bet-chip';
      const color = getBetColor(g.type);
      el.style.borderColor = color;
      const avatarHtml = g.playerAvatar
        ? `<img class="chip-avatar" src="${g.playerAvatar}" alt="" onerror="this.style.display='none'">`
        : `<div class="chip-avatar chip-avatar-empty">${(g.playerName||'?')[0].toUpperCase()}</div>`;
      el.innerHTML = `<div class="chip-left">${avatarHtml}<span class="chip-name">${g.playerName}</span></div><span class="chip-type" style="background:${color}">${getBetLabel(g.type)}</span><span class="chip-amount">$${g.amount.toFixed(2)}</span>`;
      allPlayersBetsList.appendChild(el);
    });
  }

  function addHistory(num) {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.style.backgroundColor = num === 0 ? '#8bc34a' : (isRed(num) ? '#f44336' : '#101010');
    el.style.color = num === 0 ? '#000' : '#fff';
    el.textContent = num;
    historyScroll.prepend(el);
    while (historyScroll.children.length > 20) historyScroll.removeChild(historyScroll.lastChild);
  }

  function loadHistory(arr) {
    historyScroll.innerHTML = '';
    arr.forEach(h => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.style.backgroundColor = h.num === 0 ? '#8bc34a' : (isRed(h.num) ? '#f44336' : '#101010');
      el.style.color = h.num === 0 ? '#000' : '#fff';
      el.textContent = h.num;
      historyScroll.appendChild(el);
    });
  }

  function spinToTarget(targetIdx, dur, done) {
    const desiredNorm = (targetIdx * SEG_ANGLE + SEG_ANGLE / 2) % 360;
    const currentNorm = (((-rotation) % 360) + 360) % 360;
    let diff = desiredNorm - currentNorm;
    while (diff < 0) diff += 360;
    const totalRot = 360 * 8 + diff;
    const startRot = rotation;
    const t0 = performance.now();
    let lastTick = -1;
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      rotation = startRot - totalRot * ease;
      drawWheel();
      const norm = ((-rotation % 360) + 360) % 360;
      const seg = Math.floor(norm / SEG_ANGLE);
      if (seg !== lastTick && p < 0.9) { lastTick = seg; tickSfx(); }
      if (p < 1) requestAnimationFrame(tick);
      else { rotation = startRot - totalRot; drawWheel(); done(); }
    }
    requestAnimationFrame(tick);
  }

  function updateTimerDisplay(t, phase) {
    timerValueEl.textContent = t;
    timerValueEl.classList.toggle('urgent', t <= 5);
    if (phase === 'betting') {
      gameStatusEl.textContent = `Ставки... ${t}с`;
      gameStatusEl.className = 'game-status';
      isSpinning = false;
      betBtns.forEach(b => b.disabled = false);
    } else if (phase === 'spinning') {
      gameStatusEl.textContent = 'Крутится...';
      gameStatusEl.className = 'game-status';
      isSpinning = true;
      betBtns.forEach(b => b.disabled = true);
    }
  }

  function startLocalTimer(seconds, phase) {
    if (localTimer) clearInterval(localTimer);
    let t = seconds;
    updateTimerDisplay(t, phase);
    localTimer = setInterval(() => {
      t--;
      if (t < 0) { clearInterval(localTimer); return; }
      updateTimerDisplay(t, phase);
    }, 1000);
  }

  // === SOCKET ===
  const socket = Balance.getSocket();
  const userId = Balance.getUserId();

  socket.on('connect', () => { gameStatusEl.textContent = 'Подключено'; });

  socket.on('wheel:state', (state) => {
    currentBets = state.myBets || [];
    updateMyBetsDisplay();
    if (state.balance !== undefined) Balance.sync(state.balance);
    if (state.history) loadHistory(state.history);
    if (state.phase === 'betting' && state.timer > 0) startLocalTimer(state.timer, 'betting');
  });

  socket.on('wheel:timer', (data) => startLocalTimer(data.timer, data.phase));

  socket.on('wheel:betsUpdate', (data) => {
    if (data.allBets) updateAllPlayersBets(data.allBets);
  });

  socket.on('wheel:myBets', (data) => {
    if (data.myBets) {
      currentBets = data.myBets;
      updateMyBetsDisplay();
      if (data.balance !== undefined) Balance.sync(data.balance);
    }
  });

  socket.on('wheel:spin', (data) => {
    isSpinning = true;
    betBtns.forEach(b => b.disabled = true);
    gameStatusEl.textContent = 'Крутится...';
    const targetIdx = data.result.index;
    spinToTarget(targetIdx, 5000, () => {
      const res = data.result;
      let myWin = 0;
      if (data.results && data.results[userId] !== undefined) myWin = data.results[userId];
      if (data.balances && data.balances[userId] !== undefined) {
        Balance.sync(data.balances[userId]);
      } else if (myWin > 0) {
        Balance.add(myWin);
      }
      if (myWin > 0) {
        gameStatusEl.textContent = `Выиграли $${myWin.toFixed(2)}! Выпало ${res.num}`;
        gameStatusEl.className = 'game-status success';
        winSfx();
        recordStat('win', myWin, `Wheel won ${res.num}`);
        if(window.mcStats) mcStats.addWin(myWin, 'Wheel', 'Выпало ' + res.num);
      } else {
        gameStatusEl.textContent = `Выпало ${res.num}`;
        gameStatusEl.className = 'game-status error';
        loseSfx();
        const totalBet = currentBets.reduce((s,b)=>s+b.amount,0);
        recordStat('loss', totalBet, `Wheel lost ${res.num}`);
        if(window.mcStats && totalBet > 0) mcStats.addLoss(totalBet, 'Wheel', 'Выпало ' + res.num);
      }
      resultLens.textContent = res.num;
      resultLens.style.backgroundColor = res.color === 'green' ? '#8bc34a' : (res.color === 'red' ? '#f44336' : '#101010');
      resultLens.style.color = res.color === 'green' ? '#000' : '#fff';
      resultLens.classList.remove('show');
      void resultLens.offsetWidth;
      resultLens.classList.add('show');
      if (data.history) loadHistory(data.history);
      const winList = document.getElementById('winList');
      if (winList && data.results) {
        winList.innerHTML = '';
        for (const uid in data.results) {
          if (data.results[uid] > 0) {
            const bet = data.allBets.find(b => b.userId === uid);
            const name = bet ? bet.playerName : 'Player';
            const el = document.createElement('div');
            el.className = 'win-item';
            el.innerHTML = `<span>${name}</span><span>+$${data.results[uid].toFixed(2)}</span>`;
            winList.appendChild(el);
          }
        }
      }
      setTimeout(() => {
        isSpinning = false;
        betBtns.forEach(b => b.disabled = false);
        resultLens.classList.remove('show');
      }, 2000);
    });
  });

  socket.on('wheel:newRound', (data) => {
    currentBets = [];
    updateMyBetsDisplay();
    allPlayersBetsEl.style.display = 'none';
    resultLens.classList.remove('show');
    if (data.history) loadHistory(data.history);
    gameStatusEl.textContent = 'Новый раунд! Делайте ставки';
    gameStatusEl.className = 'game-status';
    isSpinning = false;
    betBtns.forEach(b => b.disabled = false);
    bettingTable.style.display = '';
    numbersTable.classList.add('hidden');
    timerValueEl.style.display = 'block';
  });

  // === UI EVENTS ===
  betBtns.forEach(btn => btn.addEventListener('click', () => addBet(btn.dataset.bet)));

  numbersToggle.addEventListener('click', () => { bettingTable.style.display = 'none'; numbersTable.classList.remove('hidden'); });
  numbersBack.addEventListener('click', () => { numbersTable.classList.add('hidden'); bettingTable.style.display = ''; });

  function buildNumbersGrid() {
    numbersGrid.innerHTML = '';
    for (let n = 0; n <= 36; n++) {
      const btn = document.createElement('button');
      btn.className = 'num-btn'; btn.textContent = n;
      btn.style.background = n === 0 ? '#8bc34a' : (isRed(n) ? '#f44336' : '#101010');
      btn.addEventListener('click', () => addBet(String(n)));
      numbersGrid.appendChild(btn);
    }
  }
  buildNumbersGrid();

  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const a = parseFloat(btn.dataset.amount);
      const cur = parseFloat(stakeInput.value) || 0;
      stakeInput.value = Math.min(200, Math.max(0.1, cur + a)).toFixed(2);
    });
  });
  halfBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.max(0.1, v / 2).toFixed(2); });
  doubleBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.min(200, v * 2).toFixed(2); });

  document.addEventListener('click', () => initAudio(), { once: true });

  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const u = tg.initDataUnsafe.user;
      playerName = u.first_name + (u.last_name ? ' ' + u.last_name : '');
      playerAvatar = u.photo_url || '';
    }
  } catch(e) {}
});
