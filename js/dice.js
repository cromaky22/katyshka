document.addEventListener('DOMContentLoaded', function(){
  const $ = id => document.getElementById(id);
  const diceEls = [$('dice1'), $('dice2'), $('dice3')];
  const wrapEls = [$('diceWrap1'), $('diceWrap2'), $('diceWrap3')];
  const diceResult = $('diceResult'), timerEl = $('timerValue');
  const gameStatusEl = $('gameStatus'), historyScroll = $('historyScroll');
  const stakeInput = $('stakeInput'), halfBtn = $('halfBtn'), doubleBtn = $('doubleBtn');
  const bettingGrid = $('bettingGrid');
  const activeBets = $('activeBets'), activeBetsList = $('activeBetsList');
  const winAnnounce = $('winAnnounce'), winTitle = $('winTitle'), winDetails = $('winDetails');
  const allPlayersBets = $('allPlayersBets'), allPlayersBetsList = $('allPlayersBetsList');
  const hashDisplay = $('hashDisplay'), hashValue = $('hashValue');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');

  let currentMode = '1dice';
  let currentBets = [];
  let playerName = 'Player';
  let playerAvatar = '';
  let userId = 'user_' + Math.random().toString(36).substr(2, 9);
  let isRolling = false;
  let localTimer = null;
  let audioCtx = null;
  let socket = null;
  let roundActive = false;

  const PARITY = ['odd', 'notodd'];
  const DICE_COUNT = { '1dice': 1, '2dice': 2, '3dice': 3 };

  const BET_CONFIGS = {
    '1dice': [
      { type: 'odd', label: 'Четное', coef: 1.9, cls: 'btn-odd' },
      { type: 'notodd', label: 'Нечетное', coef: 1.9, cls: 'btn-notodd' },
      { type: '1', label: '1', coef: 5, cls: 'btn-number' },
      { type: '2', label: '2', coef: 5, cls: 'btn-number' },
      { type: '3', label: '3', coef: 5, cls: 'btn-number' },
      { type: '4', label: '4', coef: 5, cls: 'btn-number' },
      { type: '5', label: '5', coef: 5, cls: 'btn-number' },
      { type: '6', label: '6', coef: 5, cls: 'btn-number' }
    ],
    '2dice': [
      { type: 'odd', label: 'Четное', coef: 1.75, cls: 'btn-odd' },
      { type: 'notodd', label: 'Нечетное', coef: 2.1, cls: 'btn-notodd' },
      { type: '2', label: '2', coef: 34, cls: 'btn-sum' },
      { type: '3', label: '3', coef: 17, cls: 'btn-sum' },
      { type: '4', label: '4', coef: 11, cls: 'btn-sum' },
      { type: '5', label: '5', coef: 8, cls: 'btn-sum' },
      { type: '6', label: '6', coef: 6, cls: 'btn-sum' },
      { type: '7', label: '7', coef: 6, cls: 'btn-sum' },
      { type: '8', label: '8', coef: 6, cls: 'btn-sum' },
      { type: '9', label: '9', coef: 8, cls: 'btn-sum' },
      { type: '10', label: '10', coef: 11, cls: 'btn-sum' },
      { type: '11', label: '11', coef: 17, cls: 'btn-sum' },
      { type: '12', label: '12', coef: 34, cls: 'btn-sum' }
    ],
    '3dice': [
      { type: 'odd', label: 'Четное', coef: 1.5, cls: 'btn-odd' },
      { type: 'notodd', label: 'Нечетное', coef: 2.5, cls: 'btn-notodd' },
      { type: '3', label: '3', coef: 216, cls: 'btn-sum' },
      { type: '4', label: '4', coef: 72, cls: 'btn-sum' },
      { type: '5', label: '5', coef: 36, cls: 'btn-sum' },
      { type: '6', label: '6', coef: 21, cls: 'btn-sum' },
      { type: '7', label: '7', coef: 14, cls: 'btn-sum' },
      { type: '8', label: '8', coef: 10, cls: 'btn-sum' },
      { type: '9', label: '9', coef: 8, cls: 'btn-sum' },
      { type: '10', label: '10', coef: 7, cls: 'btn-sum' },
      { type: '11', label: '11', coef: 7, cls: 'btn-sum' },
      { type: '12', label: '12', coef: 8, cls: 'btn-sum' },
      { type: '13', label: '13', coef: 10, cls: 'btn-sum' },
      { type: '14', label: '14', coef: 14, cls: 'btn-sum' },
      { type: '15', label: '15', coef: 21, cls: 'btn-sum' },
      { type: '16', label: '16', coef: 36, cls: 'btn-sum' },
      { type: '17', label: '17', coef: 72, cls: 'btn-sum' },
      { type: '18', label: '18', coef: 216, cls: 'btn-sum' }
    ]
  };

  // Build 3D dice faces
  function buildDiceEl(diceEl) {
    diceEl.innerHTML = '';
    const faces = ['one','two','three','four','five','six'];
    const dotCounts = [1,2,3,4,5,6];
    faces.forEach((face, idx) => {
      const div = document.createElement('div');
      div.className = `face ${face}`;
      for (let i = 0; i < dotCounts[idx]; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        div.appendChild(dot);
      }
      diceEl.appendChild(div);
    });
    // Set initial state
    diceEl.className = 'dice show-1';
  }
  diceEls.forEach(el => buildDiceEl(el));

  // Get visible dice elements based on current mode
  function getVisibleDice() {
    const count = DICE_COUNT[currentMode];
    return diceEls.slice(0, count);
  }

  function setDiceVal(el, val) {
    el.classList.remove('rolling');
    // Force reflow
    void el.offsetWidth;
    el.className = `dice show-${val}`;
  }

  function showRolling() {
    getVisibleDice().forEach(d => {
      d.classList.remove('rolling');
      void d.offsetWidth;
      d.classList.add('rolling');
    });
  }

  function buildBettingGrid() {
    bettingGrid.innerHTML = '';
    const cfg = BET_CONFIGS[currentMode];
    if (currentMode === '1dice') {
      addRow(cfg.slice(0, 2));
      addRow(cfg.slice(2, 5));
      addRow(cfg.slice(5));
    } else {
      addRow(cfg.slice(0, 2));
      for (let i = 2; i < cfg.length; i += 4) addRow(cfg.slice(i, Math.min(i + 4, cfg.length)));
    }
  }

  function addRow(bets) {
    const row = document.createElement('div');
    row.className = 'betting-row';
    bets.forEach(b => {
      const btn = document.createElement('button');
      btn.className = `bet-btn ${b.cls}`;
      btn.innerHTML = `${b.label}<div class="coef">x${b.coef}</div>`;
      btn.addEventListener('click', () => placeBet(b.type));
      row.appendChild(btn);
    });
    bettingGrid.appendChild(row);
  }

  function switchMode(mode) {
    currentMode = mode;
    currentBets = [];
    roundActive = false;
    isRolling = false;
    updateBetsUI();
    updateTimer(30, 'waiting');
    modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    wrapEls[0].classList.toggle('hidden', mode !== '1dice');
    wrapEls[1].classList.toggle('hidden', mode !== '2dice');
    wrapEls[2].classList.toggle('hidden', mode !== '3dice');
    buildBettingGrid();
    resetDisplay();
  }

  function resetDisplay() {
    diceResult.classList.remove('show');
    diceResult.textContent = '';
    // Reset all dice to 1
    diceEls.forEach(d => { d.className = 'dice show-1'; });
  }

  modeBtns.forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));

  // Audio
  function initAudio() {
    if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  function tone(f, t, d, v) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
      g.gain.setValueAtTime(v, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
      o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + d);
    } catch(e) {}
  }
  function winSfx() { tone(800,'square',0.1,0.05); setTimeout(() => tone(1200,'sine',0.15,0.04), 100); }
  function loseSfx() { tone(100,'sawtooth',0.3,0.04); }

  // Balance
  function getBalance() {
    let s = localStorage.getItem('mc_balance');
    if (s === null || s === 'NaN') { s = '100.00'; localStorage.setItem('mc_balance', s); }
    const v = parseFloat(s);
    if (isNaN(v) || v < 0.5) { localStorage.setItem('mc_balance', '100.00'); return 100; }
    return v;
  }
  function setBalance(v) {
    const n = Math.round(Number(v) * 100) / 100;
    if (isNaN(n)) return;
    localStorage.setItem('mc_balance', n.toFixed(2));
    document.querySelectorAll('.balance-value').forEach(el => el.textContent = n.toFixed(2));
  }

  function getBetLabel(t) { return { odd: 'Четное', notodd: 'Нечетное' }[t] || t; }
  function getBetColor(t) {
    if (t === 'odd') return '#2196f3';
    if (t === 'notodd') return '#607d8b';
    return '#4caf50';
  }

  function updateBetsUI() {
    if (!currentBets.length) { activeBets.style.display = 'none'; return; }
    activeBets.style.display = 'flex';
    activeBetsList.innerHTML = '';
    const grouped = {};
    currentBets.forEach(b => {
      if (!grouped[b.type]) grouped[b.type] = { type: b.type, amount: 0 };
      grouped[b.type].amount += b.amount;
    });
    Object.values(grouped).forEach(group => {
      const el = document.createElement('div');
      el.className = 'active-bet-item';
      el.style.background = getBetColor(group.type);
      el.innerHTML = `<span>${getBetLabel(group.type)}</span><span>$${group.amount.toFixed(2)}</span>`;
      activeBetsList.appendChild(el);
    });
  }

  function placeBet(type) {
    if (isRolling) return;
    const stake = parseFloat(stakeInput.value) || 0;
    if (stake < 0.5) { gameStatusEl.textContent = 'Мин. ставка $0.50'; gameStatusEl.className = 'game-status error'; return; }
    if (stake > 200) { gameStatusEl.textContent = 'Макс. ставка $200'; gameStatusEl.className = 'game-status error'; return; }
    const total = currentBets.reduce((s, b) => s + b.amount, 0);
    if (total + stake > getBalance()) { gameStatusEl.textContent = 'Недостаточно средств'; gameStatusEl.className = 'game-status error'; return; }
    if (PARITY.includes(type)) {
      const existing = currentBets.find(b => PARITY.includes(b.type));
      if (existing && existing.type !== type) {
        gameStatusEl.textContent = 'Только чет ИЛИ нечет!';
        gameStatusEl.className = 'game-status error';
        return;
      }
    }
    currentBets.push({ type, amount: stake });
    updateBetsUI();
    gameStatusEl.textContent = '';
    socket.emit('dice:bet', { type, amount: stake, diceType: currentMode, playerName, playerAvatar });
  }

  function updateAllBets(list) {
    if (!list || !list.length) { allPlayersBets.style.display = 'none'; return; }
    allPlayersBets.style.display = 'flex';
    allPlayersBetsList.innerHTML = '';
    list.forEach(b => {
      const el = document.createElement('div');
      el.className = 'player-bet-item';
      el.style.borderLeftColor = getBetColor(b.type);
      const av = b.playerAvatar
        ? `<img class="player-bet-avatar" src="${b.playerAvatar}" onerror="this.style.display='none'">`
        : `<div class="player-bet-avatar player-bet-avatar-empty">${(b.playerName||'?')[0].toUpperCase()}</div>`;
      el.innerHTML = `<div class="player-bet-left">${av}<div class="player-bet-info"><span class="player-bet-name">${b.playerName||'Player'}</span><span class="player-bet-type">${getBetLabel(b.type)}</span></div></div><span class="player-bet-amount">$${b.amount.toFixed(2)}</span>`;
      allPlayersBetsList.appendChild(el);
    });
  }

  function addHistory(sum) {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.style.backgroundColor = sum % 2 === 0 ? '#2196f3' : '#607d8b';
    el.textContent = sum;
    historyScroll.insertBefore(el, historyScroll.firstChild);
    while (historyScroll.children.length > 20) historyScroll.removeChild(historyScroll.lastChild);
  }

  function updateTimer(t, phase) {
    timerEl.textContent = t;
    timerEl.classList.toggle('urgent', t <= 5 && phase !== 'waiting');
    if (phase === 'waiting') {
      gameStatusEl.textContent = 'Ожидание ставок...';
      gameStatusEl.className = 'game-status';
      isRolling = false;
      document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
    } else if (phase === 'betting') {
      gameStatusEl.textContent = `Ставки... ${t}с`;
      gameStatusEl.className = 'game-status';
      isRolling = false;
      document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
    } else if (phase === 'rolling') {
      gameStatusEl.textContent = 'Бросаем...';
      gameStatusEl.className = 'game-status';
      isRolling = true;
      document.querySelectorAll('.bet-btn').forEach(b => b.disabled = true);
    }
  }

  function startLocalTimer(secs, phase) {
    if (localTimer) clearInterval(localTimer);
    roundActive = true;
    let t = secs;
    updateTimer(t, phase);
    localTimer = setInterval(() => {
      t--;
      if (t < 0) { clearInterval(localTimer); return; }
      updateTimer(t, phase);
    }, 1000);
  }

  function showResult(nums, resultData) {
    const sum = nums.reduce((a, b) => a + b, 0);
    const myWin = resultData ? resultData.win : 0;
    const myBet = resultData ? resultData.bet : 0;

    // Set visible dice values
    const visible = getVisibleDice();
    visible.forEach((d, i) => {
      setDiceVal(d, nums[i]);
    });

    diceResult.textContent = `Сумма: ${sum}`;
    diceResult.classList.add('show');
    addHistory(sum);

    winAnnounce.style.display = 'flex';
    if (myWin > 0) {
      winTitle.textContent = '🎉 Вы выиграли!';
      winDetails.innerHTML = `<div class="win-row"><span>Выигрыш</span><span>+$${myWin.toFixed(2)}</span></div>`;
      winSfx();
    } else if (myBet > 0) {
      winTitle.textContent = '😔 Вы проиграли';
      winDetails.innerHTML = `<div class="win-row lose"><span>Проигрыш</span><span>-$${myBet.toFixed(2)}</span></div>`;
      loseSfx();
    } else {
      winTitle.textContent = 'Результат';
      winDetails.innerHTML = `<div class="win-row"><span>Сумма</span><span>${sum}</span></div>`;
    }
    gameStatusEl.textContent = `Выпало: ${sum} (${sum % 2 === 0 ? 'Четное' : 'Нечетное'})`;
    gameStatusEl.className = myWin > 0 ? 'game-status success' : myBet > 0 ? 'game-status error' : 'game-status';
  }

  // Socket
  function setupSocket() {
    if (socket) socket.disconnect();
    socket = io({ query: { userId } });

    socket.on('connect', () => {
      gameStatusEl.textContent = 'Подключено';
      roundActive = false;
      updateTimer(30, 'waiting');
    });

    ['1dice', '2dice', '3dice'].forEach(diceType => {
      const p = `dice:${diceType}`;

      socket.on(`${p}:state`, (state) => {
        if (diceType !== currentMode) return;
        currentBets = state.myBets || [];
        updateBetsUI();
        if (state.history) {
          historyScroll.innerHTML = '';
          state.history.forEach(h => addHistory(h.sum));
        }
        if (state.phase === 'betting' && state.timer > 0) {
          roundActive = true;
          startLocalTimer(state.timer, 'betting');
        } else if (state.phase === 'waiting') {
          roundActive = false;
          updateTimer(30, 'waiting');
        }
      });

      socket.on(`${p}:timer`, (data) => {
        if (diceType !== currentMode) return;
        if (data.phase === 'betting') {
          roundActive = true;
          startLocalTimer(data.timer, 'betting');
        }
      });

      socket.on(`${p}:betsUpdate`, (data) => {
        if (diceType !== currentMode) return;
        if (data.myBets) { currentBets = data.myBets; updateBetsUI(); }
        if (data.allBets) updateAllBets(data.allBets);
        if (!roundActive && !isRolling) {
          roundActive = true;
          startLocalTimer(30, 'betting');
        }
      });

      socket.on(`${p}:roll`, (data) => {
        if (diceType !== currentMode) return;
        isRolling = true;
        roundActive = false;
        document.querySelectorAll('.bet-btn').forEach(b => b.disabled = true);
        gameStatusEl.textContent = 'Бросаем...';
        showRolling();

        setTimeout(() => {
          const nums = data.result.nums || [data.result.num];
          const myRes = (data.results && data.results[userId]) || { win: 0, bet: 0 };
          let totalBet = 0;
          currentBets.forEach(b => totalBet += b.amount);
          if (myRes.win > 0) setBalance(getBalance() + myRes.win);
          showResult(nums, { win: myRes.win, bet: totalBet });
          hashDisplay.style.display = 'block';
          hashValue.textContent = data.hash || '';
        }, 1500);

        setTimeout(() => {
          isRolling = false;
          document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
          winAnnounce.style.display = 'none';
        }, 5000);
      });

      socket.on(`${p}:newRound`, (data) => {
        if (diceType !== currentMode) return;
        currentBets = [];
        roundActive = false;
        isRolling = false;
        updateBetsUI();
        allPlayersBets.style.display = 'none';
        winAnnounce.style.display = 'none';
        hashDisplay.style.display = 'none';
        gameStatusEl.textContent = 'Ожидание ставок...';
        gameStatusEl.className = 'game-status';
        document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
        resetDisplay();
        updateTimer(30, 'waiting');
      });
    });
  }

  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const a = parseFloat(btn.dataset.amount);
      const c = parseFloat(stakeInput.value) || 0;
      stakeInput.value = Math.min(200, Math.max(0.5, c + a)).toFixed(2);
    });
  });
  halfBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.max(0.5, v / 2).toFixed(2); });
  doubleBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.min(200, v * 2).toFixed(2); });

  document.addEventListener('click', () => initAudio(), { once: true });
  document.querySelectorAll('.balance-value').forEach(el => el.textContent = getBalance().toFixed(2));

  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const u = tg.initDataUnsafe.user;
      playerName = u.first_name + (u.last_name ? ' ' + u.last_name : '');
      playerAvatar = u.photo_url || '';
      userId = String(u.id);
    }
  } catch(e) {}

  buildBettingGrid();
  setupSocket();
  updateTimer(30, 'waiting');
});
