document.addEventListener('DOMContentLoaded', function() {

  // === DOM ===
  const canvas = document.getElementById('battleWheelCanvas');
  const ctx = canvas.getContext('2d');
  const timerEl = document.getElementById('battleTimer');
  const resultEl = document.getElementById('battleWheelResult');
  const phaseEl = document.getElementById('battlePhase');
  const betInput = document.getElementById('battleBetInput');
  const betBtn = document.getElementById('battleBetBtn');
  const bankEl = document.getElementById('battleBank');
  const playersGrid = document.getElementById('battlePlayersGrid');
  const myBetsEl = document.getElementById('battleMyBets');
  const myBetsList = document.getElementById('battleMyBetsList');
  const statusEl = document.getElementById('battleStatus');
  const gameNumberEl = document.getElementById('gameNumber');
  const historyEl = document.getElementById('battleHistory');
  const winnerDisplay = document.getElementById('battleWinnerDisplay');
  const winnerNameEl = document.getElementById('battleWinnerName');
  const winnerAmountEl = document.getElementById('battleWinnerAmount');
  const halfBtn = document.getElementById('battleHalfBtn');
  const doubleBtn = document.getElementById('battleDoubleBtn');
  const quickBtns = document.querySelectorAll('.battle-quick-btn');

  // === STATE ===
  let rotation = 0;
  let isSpinning = false;
  let currentBets = [];
  let allPlayers = [];
  let totalBank = 0;
  let roundId = 0;
  let playerName = 'Player';
  let playerAvatar = '';
  let audioCtx = null;
  let localTimer = null;

  // === CANVAS SETUP ===
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
  setupCanvas();
  window.addEventListener('resize', setupCanvas);

  const CX = () => canvas.width / 2;
  const CY = () => canvas.height / 2;
  const R = () => canvas.width / 2 - 4;

  // === PLAYER COLORS ===
  const PLAYER_COLORS = [
    '#e53935', '#8b5cf6', '#2196f3', '#4caf50', '#ff9800',
    '#00bcd4', '#e91e63', '#3f51b5', '#009688', '#ff5722',
    '#607d8b', '#795548', '#9c27b0', '#03a9f4', '#cddc39',
    '#f44336', '#673ab7', '#00acc1', '#8bc34a', '#ffc107'
  ];

  function getPlayerColor(index) {
    return PLAYER_COLORS[index % PLAYER_COLORS.length];
  }

  // === DRAW WHEEL ===
  function drawWheel() {
    const cx = CX(), cy = CY(), r = R();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (allPlayers.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = `bold ${Math.round(r * 0.08)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Ожидание игроков...', cx, cy);
      return;
    }

    const total = allPlayers.reduce((s, p) => s + p.amount, 0);
    if (total === 0) return;

    let startAngle = rotation * Math.PI / 180 - Math.PI / 2;

    allPlayers.forEach((player, i) => {
      const sliceAngle = (player.amount / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const color = getPlayerColor(i);

      // Segment
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text (player name + chance)
      if (sliceAngle > 0.12) {
        const midAngle = startAngle + sliceAngle / 2;
        const textR = r * 0.65;
        ctx.save();
        ctx.translate(cx + textR * Math.cos(midAngle), cy + textR * Math.sin(midAngle));
        ctx.rotate(midAngle + Math.PI / 2);

        const chance = Math.round((player.amount / total) * 100);
        const name = player.name.length > 8 ? player.name.substring(0, 8) + '..' : player.name;

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(r * 0.065)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.fillText(name, 0, -Math.round(r * 0.035));
        ctx.font = `bold ${Math.round(r * 0.08)}px Arial`;
        ctx.fillStyle = '#ffd700';
        ctx.fillText(chance + '%', 0, Math.round(r * 0.045));

        ctx.restore();
      }

      startAngle = endAngle;
    });

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0d1a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // === AUDIO ===
  function initAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
  }
  function tickSfx() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(500 + Math.random() * 400, audioCtx.currentTime);
      g.gain.setValueAtTime(0.03, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.04);
    } catch(e) {}
  }
  function winSfx() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, audioCtx.currentTime);
          g.gain.setValueAtTime(0.06, audioCtx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
          o.connect(g).connect(audioCtx.destination);
          o.start();
          o.stop(audioCtx.currentTime + 0.2);
        }, i * 100);
      });
    } catch(e) {}
  }
  function loseSfx() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(120, audioCtx.currentTime);
      g.gain.setValueAtTime(0.04, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.4);
    } catch(e) {}
  }

  // === UI UPDATES ===
  function updatePlayersGrid() {
    playersGrid.innerHTML = '';
    const total = allPlayers.reduce((s, p) => s + p.amount, 0);

    allPlayers.forEach((player, i) => {
      const chance = total > 0 ? Math.round((player.amount / total) * 100) : 0;
      const isMe = player.userId === (Balance.getUserId() || '');
      const color = getPlayerColor(i);

      const card = document.createElement('div');
      card.className = 'battle-player-card' + (isMe ? ' is-me' : '');
      card.id = 'player-card-' + player.userId;

      const avatarHtml = player.avatar
        ? `<img class="battle-player-avatar" src="${player.avatar}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
      const placeholderHtml = `<div class="battle-player-avatar-placeholder" style="background:${color}">${(player.name || '?')[0].toUpperCase()}</div>`;

      card.innerHTML =
        `${avatarHtml}${placeholderHtml}` +
        `<span class="battle-player-name">${player.name}</span>` +
        `<span class="battle-player-amount">$${player.amount.toFixed(2)}</span>` +
        `<span class="battle-player-chance">${chance}%</span>`;

      playersGrid.appendChild(card);
    });
  }

  function updateMyBets() {
    const myBet = currentBets.find(b => b.userId === (Balance.getUserId() || ''));
    if (!myBet) {
      myBetsEl.style.display = 'none';
      return;
    }
    myBetsEl.style.display = 'flex';
    myBetsList.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'battle-my-bet-item';
    el.innerHTML = `<span>Ваша ставка</span><span class="bet-amount">$${myBet.amount.toFixed(2)}</span>`;
    myBetsList.appendChild(el);
  }

  function updateBank() {
    bankEl.textContent = '$' + totalBank.toFixed(2);
  }

  function updatePhase(phase, timer) {
    timerEl.textContent = timer;
    timerEl.classList.toggle('urgent', timer <= 5);

    phaseEl.classList.remove('betting', 'spinning', 'result');

    if (phase === 'betting') {
      phaseEl.textContent = `Ставки открыты — ${timer}с`;
      phaseEl.classList.add('betting');
      isSpinning = false;
      betBtn.disabled = false;
    } else if (phase === 'spinning') {
      phaseEl.textContent = 'Колесо крутится...';
      phaseEl.classList.add('spinning');
      isSpinning = true;
      betBtn.disabled = true;
    } else if (phase === 'result') {
      phaseEl.textContent = 'Результат!';
      phaseEl.classList.add('result');
      isSpinning = true;
      betBtn.disabled = true;
    }
  }

  function addHistory(winnerName, winnerAmount, color) {
    const el = document.createElement('div');
    el.className = 'battle-history-item';
    el.style.background = color || 'rgba(255,255,255,0.1)';
    el.innerHTML = `<span class="hi-winner">${winnerName}</span> $${winnerAmount.toFixed(0)}`;
    historyEl.prepend(el);
    while (historyEl.children.length > 15) {
      historyEl.removeChild(historyEl.lastChild);
    }
  }

  function loadHistory(history) {
    historyEl.innerHTML = '';
    if (!history || !history.length) return;
    history.forEach(h => addHistory(h.winnerName, h.winnerAmount, h.color));
  }

  // === SPIN WHEEL ===
  function spinToWinner(winnerIndex, dur, done) {
    const total = allPlayers.reduce((s, p) => s + p.amount, 0);
    if (total === 0 || allPlayers.length === 0) { done(); return; }

    // Calculate the angle range for the winner's segment
    let startAngle = 0;
    for (let i = 0; i < winnerIndex; i++) {
      startAngle += (allPlayers[i].amount / total) * 360;
    }
    const winnerAngle = (allPlayers[winnerIndex].amount / total) * 360;
    const targetMid = startAngle + winnerAngle / 2;

    // The pointer is at top (270 degrees in canvas coords, but we use -90 offset)
    // We need rotation so that targetMid aligns with the top
    const currentNorm = (((-rotation) % 360) + 360) % 360;
    let diff = (270 - targetMid) - currentNorm;
    while (diff < 0) diff += 360;
    const totalRot = 360 * 6 + diff;
    const startRot = rotation;
    const t0 = performance.now();
    let lastTick = -1;

    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      rotation = startRot - totalRot * ease;
      drawWheel();

      // Tick sound based on segment crossing
      const norm = ((-rotation % 360) + 360) % 360;
      const segSize = allPlayers.length > 0 ? 360 / allPlayers.length : 30;
      const seg = Math.floor(norm / segSize);
      if (seg !== lastTick && p < 0.92) {
        lastTick = seg;
        tickSfx();
      }

      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        rotation = startRot - totalRot;
        drawWheel();
        done();
      }
    }
    requestAnimationFrame(tick);
  }

  // === SOCKET ===
  const socket = Balance.getSocket();
  const userId = Balance.getUserId();

  socket.on('connect', () => {
    statusEl.textContent = 'Подключено';
    statusEl.className = 'battle-status';
  });

  socket.on('battle:state', (state) => {
    roundId = state.roundId || 0;
    allPlayers = state.players || [];
    totalBank = state.totalBank || 0;
    currentBets = state.myBets || [];

    gameNumberEl.textContent = 'Игра #' + (roundId + 1);
    updatePlayersGrid();
    updateBank();
    updateMyBets();

    if (state.history) loadHistory(state.history);
    if (state.balance !== undefined) Balance.sync(state.balance);

    if (state.phase) {
      updatePhase(state.phase, state.timer || 0);
      if (state.phase === 'betting' && state.timer > 0) {
        startLocalTimer(state.timer, 'betting');
      }
    }

    drawWheel();
  });

  socket.on('battle:timer', (data) => {
    updatePhase(data.phase, data.timer);
    startLocalTimer(data.timer, data.phase);
  });

  socket.on('battle:playersUpdate', (data) => {
    allPlayers = data.players || [];
    totalBank = data.totalBank || 0;
    updatePlayersGrid();
    updateBank();
    drawWheel();
  });

  socket.on('battle:myBet', (data) => {
    currentBets = data.myBets || [];
    updateMyBets();
    if (data.balance !== undefined) Balance.sync(data.balance);
  });

  socket.on('battle:spin', (data) => {
    isSpinning = true;
    betBtn.disabled = true;
    updatePhase('spinning', 0);

    const winner = data.winner;
    const winnerIdx = allPlayers.findIndex(p => p.userId === winner.userId);

    if (winnerIdx === -1) {
      statusEl.textContent = 'Ошибка: победитель не найден';
      statusEl.className = 'battle-status error';
      return;
    }

    const color = getPlayerColor(winnerIdx);
    spinToWinner(winnerIdx, 5000, () => {
      // Show result
      const isMe = winner.userId === userId;
      const myBet = currentBets.find(b => b.userId === userId);

      if (isMe && data.payout) {
        statusEl.textContent = `🎉 Вы выиграли $${data.payout.toFixed(2)}!`;
        statusEl.className = 'battle-status success';
        winSfx();
        if (window.mcStats) mcStats.addWin(data.payout, 'Battle Wheel', 'Победа в раунде');
      } else {
        statusEl.textContent = `Победитель: ${winner.name}`;
        statusEl.className = 'battle-status';
        if (myBet) {
          loseSfx();
          if (window.mcStats) mcStats.addLoss(myBet.amount, 'Battle Wheel', 'Проигрыш в раунде');
        }
      }

      // Show winner display
      winnerDisplay.style.display = 'flex';
      winnerNameEl.textContent = winner.name;
      winnerAmountEl.textContent = '+$' + (data.payout || 0).toFixed(2);

      // Show result in center
      resultEl.innerHTML = '👑<br><span style="font-size:9px">' + winner.name.substring(0, 10) + '</span>';
      resultEl.style.background = color;
      resultEl.classList.remove('show');
      void resultEl.offsetWidth;
      resultEl.classList.add('show');

      // Add to history
      addHistory(winner.name, data.payout || 0, color);

      // Update balance
      if (data.balances && data.balances[userId] !== undefined) {
        Balance.sync(data.balances[userId]);
      }

      // Highlight winner card
      document.querySelectorAll('.battle-player-card').forEach(c => c.classList.remove('is-winner'));
      const winnerCard = document.getElementById('player-card-' + winner.userId);
      if (winnerCard) winnerCard.classList.add('is-winner');
    });
  });

  socket.on('battle:newRound', (data) => {
    roundId = data.roundId || 0;
    allPlayers = [];
    totalBank = 0;
    currentBets = [];

    gameNumberEl.textContent = 'Игра #' + (roundId + 1);
    updatePlayersGrid();
    updateBank();
    updateMyBets();
    drawWheel();

    winnerDisplay.style.display = 'none';
    resultEl.classList.remove('show');
    document.querySelectorAll('.battle-player-card').forEach(c => c.classList.remove('is-winner'));

    if (data.history) loadHistory(data.history);

    statusEl.textContent = 'Новый раунд! Делайте ставки';
    statusEl.className = 'battle-status';
    isSpinning = false;
    betBtn.disabled = false;
  });

  // === LOCAL TIMER ===
  function startLocalTimer(seconds, phase) {
    if (localTimer) clearInterval(localTimer);
    let t = seconds;
    updatePhase(phase, t);
    localTimer = setInterval(() => {
      t--;
      if (t < 0) { clearInterval(localTimer); return; }
      updatePhase(phase, t);
    }, 1000);
  }

  // === BET ACTION ===
  function placeBet() {
    if (isSpinning) return;
    const amount = parseFloat(betInput.value) || 0;
    if (amount < 0.1) {
      statusEl.textContent = 'Мин. ставка $0.10';
      statusEl.className = 'battle-status error';
      return;
    }
    if (amount > 500) {
      statusEl.textContent = 'Макс. ставка $500';
      statusEl.className = 'battle-status error';
      return;
    }
    if (amount > Balance.get()) {
      statusEl.textContent = 'Недостаточно средств';
      statusEl.className = 'battle-status error';
      return;
    }

    socket.emit('battle:bet', { amount, playerName, playerAvatar });
    if (window.mcStats) mcStats.addBet(amount, 'Battle Wheel', 'Ставка в раунде');
    const uid = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || '';
    if (uid) fetch('/api/wager/bet', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ userId: uid, amount })
    }).catch(function(){});
  }

  // === UI EVENTS ===
  betBtn.addEventListener('click', placeBet);

  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const a = parseFloat(btn.dataset.amount);
      const cur = parseFloat(betInput.value) || 0;
      betInput.value = Math.min(500, Math.max(0.1, cur + a)).toFixed(2);
    });
  });

  halfBtn.addEventListener('click', () => {
    const v = parseFloat(betInput.value) || 0;
    betInput.value = Math.max(0.1, v / 2).toFixed(2);
  });

  doubleBtn.addEventListener('click', () => {
    const v = parseFloat(betInput.value) || 0;
    betInput.value = Math.min(500, v * 2).toFixed(2);
  });

  // Tab switching
  document.querySelectorAll('.battle-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.battle-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  document.addEventListener('click', () => initAudio(), { once: true });

  // === TELEGRAM USER INFO ===
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const u = tg.initDataUnsafe.user;
      playerName = u.first_name + (u.last_name ? ' ' + u.last_name : '');
      playerAvatar = u.photo_url || '';
    }
  } catch(e) {}

  // Initial draw
  drawWheel();
});
