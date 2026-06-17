document.addEventListener('DOMContentLoaded', function() {
  // === DOM ===
  const canvas = document.getElementById('battleWheelCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const timerEl = document.getElementById('battleTimer');
  const resultEl = document.getElementById('battleResult');
  const phaseEl = document.getElementById('battlePhase');
  const betInput = document.getElementById('battleBetInput');
  const betBtn = document.getElementById('battleBetBtn');
  const bankEl = document.getElementById('battleBank');
  const playersGrid = document.getElementById('battlePlayersGrid');
  const myBetsEl = document.getElementById('battleMyBets');
  const myBetsList = document.getElementById('battleMyBetsList');
  const statusEl = document.getElementById('battleStatus');
  const gameNumberEl = document.getElementById('gameNumber');
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
   let battleHistory = [];

  // === CANVAS SETUP (moved after DOM but before drawWheel) ===
  function setupCanvas() {
    if (!canvas) return;
    const wrapper = document.getElementById('wheelWrapper');
    if (!wrapper) return;
    const size = wrapper.offsetWidth;
    if (size < 50) return;
    canvas.width = size * 2;
    canvas.height = size * 2;
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
    if (!canvas || !ctx) return;
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

    // Draw wheel background with gradient
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    bgGrad.addColorStop(0, '#1a1a2e');
    bgGrad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    allPlayers.forEach((player, i) => {
      const sliceAngle = (player.amount / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const color = getPlayerColor(i);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      
      // Create gradient stroke instead of full fill
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      ctx.stroke();

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

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.stroke();

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
        ? `<img class="battle-player-avatar" src="${player.avatar}" alt="" onerror="this.style.display='none'">`
        : `<div class="battle-player-avatar-placeholder" style="background:${color}">${(player.name || '?')[0].toUpperCase()}</div>`;

      card.innerHTML =
        avatarHtml +
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
    timerEl.style.visibility = phase === 'waiting' ? 'hidden' : 'visible';
    phaseEl.classList.remove('betting', 'spinning', 'result', 'waiting');

    if (phase === 'waiting') {
      phaseEl.textContent = 'Ожидание игроков...';
      phaseEl.classList.add('waiting');
      isSpinning = false;
      betBtn.disabled = false;
    } else if (phase === 'betting') {
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

  function addToHistory(winnerName, winnerAmount, bank, chance, avatar, roundId) {
    battleHistory.unshift({ winnerName, winnerAmount, bank, chance, avatar, roundId });
    while (battleHistory.length > 50) battleHistory.pop();
  }

  function loadHistory(history) {
    battleHistory = history || [];
  }

  // === SPIN WHEEL ===
  function spinToWinner(winnerIndex, dur, done) {
    const total = allPlayers.reduce((s, p) => s + p.amount, 0);
    if (total === 0 || allPlayers.length === 0) { done(); return; }

    let startAngle = 0;
    for (let i = 0; i < winnerIndex; i++) {
      startAngle += (allPlayers[i].amount / total) * 360;
    }
    const winnerAngle = (allPlayers[winnerIndex].amount / total) * 360;
    const targetMid = startAngle + winnerAngle / 2;

    const currentNorm = (((-rotation) % 360) + 360) % 360;
    let diff = (270 - targetMid) - currentNorm;
    while (diff < 0) diff += 360;
    const totalRot = 360 * 6 + diff;
    const startRot = rotation;
    const t0 = performance.now();

    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      rotation = startRot - totalRot * ease;
      drawWheel();

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

  // === TELEGRAM USER INFO ===
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const u = tg.initDataUnsafe.user;
      playerName = u.first_name + (u.last_name ? ' ' + u.last_name : '');
      playerAvatar = u.photo_url || '';
      localStorage.setItem('player_name', playerName);
      if (u.photo_url) localStorage.setItem('player_avatar', u.photo_url);
    }
  } catch(e) {}
  if (!playerName || playerName === 'Player') {
    playerName = localStorage.getItem('player_name') || 'Player';
    playerAvatar = localStorage.getItem('player_avatar') || '';
  }

  // === SOCKET ===
  const socket = Balance.getSocket();
  const myUserId = Balance.getUserId();

  let socketReady = false;

  function onSocketReady() {
    if (socketReady) return;
    socketReady = true;
    statusEl.textContent = 'Подключено';
    statusEl.className = 'battle-status';
    socket.emit('battle:getState');
    socket.emit('battle:getTop');
  }

  // Handle socket connection
  if (socket) {
    if (socket.connected) {
      onSocketReady();
    } else {
      socket.on('connect', onSocketReady);
    }
  } else {
    statusEl.textContent = 'Ошибка: нет соединения';
    statusEl.className = 'battle-status error';
  }

  setTimeout(() => {
    if (!socketReady) {
      statusEl.textContent = 'Ошибка соединения';
      statusEl.className = 'battle-status error';
    }
  }, 5000);

  socket.on('battle:state', (state) => {
    roundId = state.roundId || 0;
    allPlayers = state.players || [];
    totalBank = state.totalBank || 0;
    currentBets = state.myBets || [];

    gameNumberEl.textContent = 'Игра #' + (roundId + 1);
    updatePlayersGrid();
    updateBank();
    updateMyBets();

    if (state.history && state.history.length) loadHistory(state.history);
    if (state.balance !== undefined) Balance.sync(state.balance);

    if (state.phase) {
      updatePhase(state.phase, state.timer || 0);
      if (state.phase === 'betting' && state.timer > 0) {
        startLocalTimer(state.timer, 'betting');
      }
    } else {
      updatePhase('waiting', 0);
    }
    drawWheel();
  });

  socket.on('battle:timer', (data) => {
    updatePhase(data.phase, data.timer);
    if (data.phase !== 'waiting') {
      startLocalTimer(data.timer, data.phase);
    }
  });

  socket.on('battle:playersUpdate', (data) => {
    allPlayers = data.players || [];
    totalBank = data.totalBank || 0;
    updatePlayersGrid();
    updateBank();
    drawWheel();
    // Sync balance if provided
    if (data.balances && data.balances[myUserId] !== undefined) {
      Balance.sync(data.balances[myUserId]);
    }
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
    const winnerIdx = data.winnerIndex;

    if (winnerIdx === undefined || winnerIdx < 0) {
      statusEl.textContent = 'Ошибка: победитель не найден';
      statusEl.className = 'battle-status error';
      return;
    }

    // Use players from server to ensure correct order
    allPlayers = data.players || [];
    totalBank = data.totalBank || 0;

    const color = getPlayerColor(winnerIdx);
    const chance = totalBank > 0 ? Math.round((winner.amount / totalBank) * 100) : 0;

    spinToWinner(winnerIdx, 5000, () => {
      const isMe = winner.userId === myUserId;
      const myBet = currentBets.find(b => b.userId === myUserId);

      if (isMe && data.payout) {
        statusEl.textContent = `Вы выиграли $${data.payout.toFixed(2)}!`;
        statusEl.className = 'battle-status success';
        if (window.mcStats) mcStats.addWin(data.payout, 'Battle Wheel', 'Победа');
      } else {
        statusEl.textContent = `Победитель: ${winner.name}`;
        statusEl.className = 'battle-status';
        if (myBet) {
          if (window.mcStats) mcStats.addLoss(myBet.amount, 'Battle Wheel', 'Проигрыш');
        }
      }

      winnerDisplay.style.display = 'flex';
      winnerNameEl.textContent = winner.name;
      winnerAmountEl.textContent = '+$' + (data.payout || 0).toFixed(2);

      resultEl.innerHTML = '👑<br><span style="font-size:9px">' + winner.name.substring(0, 10) + '</span>';
      resultEl.style.background = color;
      resultEl.classList.remove('show');
      void resultEl.offsetWidth;
      resultEl.classList.add('show');

      addToHistory(winner.name, data.payout || 0, totalBank, chance, winner.avatar, roundId);

      if (data.balances && data.balances[myUserId] !== undefined) {
        Balance.sync(data.balances[myUserId]);
      }

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

    statusEl.textContent = 'Новый раунд! Ждём игроков...';
    statusEl.className = 'battle-status';
    isSpinning = false;
    betBtn.disabled = false;
    updatePhase('waiting', 0);
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
    if (!socketReady) {
      statusEl.textContent = 'Ожидание подключения...';
      statusEl.className = 'battle-status error';
      return;
    }
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
    if (window.mcStats) mcStats.addBet(amount, 'Battle Wheel', 'Ставка');
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

  const tabs = document.querySelectorAll('.battle-tab');
  let topPlayers = [];

  function renderHistoryModal() {
    const modalBody = document.getElementById('battleHistoryModalBody');
    if (!modalBody) return;
    modalBody.innerHTML = '';
    if (battleHistory.length === 0) {
      modalBody.innerHTML = '<div style="color:rgba(255,255,255,0.4); font-size:14px; padding:20px; text-align:center;">История пуста</div>';
      return;
    }
    battleHistory.forEach((h) => {
      const el = document.createElement('div');
      el.className = 'battle-history-modal-item';
      const avatarHtml = h.avatar ? '<img class="battle-history-modal-avatar" src="' + h.avatar + '" alt="">' : '<div class="battle-history-modal-avatar-placeholder">' + (h.winnerName || '?')[0].toUpperCase() + '</div>';
      el.innerHTML = '<div>' + avatarHtml + '</div>' + '<div class="battle-history-modal-info">' + '<div class="battle-history-modal-game">Игра #' + (h.roundId + 1) + '</div>' + '<div class="battle-history-modal-name">' + (h.winnerName || '—') + '</div>' + '<div class="battle-history-modal-details">' + '<span class="battle-history-modal-bank">Банк: $' + (h.bank || 0).toFixed(2) + '</span>' + '<span class="battle-history-modal-chance">Шанс: ' + (h.chance || 0) + '%</span>' + '</div>' + '</div>' + '<button class="battle-history-detail-btn" data-round="' + h.roundId + '">Детали</button>';
      modalBody.appendChild(el);
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'history') {
        renderHistoryModal();
        const modal = document.getElementById('battleHistoryModal');
        if (modal) modal.style.display = 'flex';
      } else {
        const modal = document.getElementById('battleHistoryModal');
        if (modal) modal.style.display = 'none';
      }
    });
  });

  const historyClose = document.getElementById('battleHistoryClose');
  if (historyClose) {
    historyClose.addEventListener('click', () => {
      const modal = document.getElementById('battleHistoryModal');
      if (modal) modal.style.display = 'none';
      document.querySelector('.battle-tab[data-tab="top"]').click();
    });
  }

  const modalBody = document.getElementById('battleHistoryModalBody');
  if (modalBody) {
    modalBody.addEventListener('click', (e) => {
      if (e.target.classList.contains('battle-history-detail-btn')) {
        const roundId = e.target.dataset.round;
        const item = battleHistory.find(h => h.roundId == roundId);
        if (item) {
          alert('Раунд ' + roundId + ': ' + item.winnerName + ' выиграл $' + (item.winnerAmount || 0).toFixed(2));
        }
      }
    });
  }

  socket.on('battle:top', (data) => {
    topPlayers = data.players || [];
  });

  document.addEventListener('click', () => initAudio(), { once: true });

  drawWheel();
});