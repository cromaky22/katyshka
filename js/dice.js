document.addEventListener('DOMContentLoaded', function(){
  // === STATS HELPER ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId, type, amount: Math.abs(amount), detail: detail || 'Dice'})
      }).catch(function(){});
    }catch(e){}
  }
  
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
  let playerName = 'Player';
  let playerAvatar = '';
  let userId = 'user_' + Math.random().toString(36).substr(2, 9);
  let audioCtx = null;
  let socket = null;

  // State for all dice modes
  let allStates = {
    '1dice': { bets: [], roundActive: false, localTimer: null },
    '2dice': { bets: [], roundActive: false, localTimer: null },
    '3dice': { bets: [], roundActive: false, localTimer: null }
  };

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
    diceEl.className = 'dice show-1';
  }
  diceEls.forEach(el => buildDiceEl(el));

  function getVisibleDice() {
    return diceEls.slice(0, DICE_COUNT[currentMode]);
  }

  function setDiceVal(el, val) {
    el.classList.remove('rolling');
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

  function getCurrentState() {
    return allStates[currentMode];
  }

  function isRolling() {
    return getCurrentState().roundActive === 'rolling';
  }

  function switchMode(mode) {
    // Save current state
    currentMode = mode;
    const state = getCurrentState();

    modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    // Show correct number of dice
    wrapEls[0].classList.remove('hidden');
    wrapEls[1].classList.toggle('hidden', mode === '1dice');
    wrapEls[2].classList.toggle('hidden', mode !== '3dice');

    buildBettingGrid();
    updateBetsUI();
    resetDisplay();

    // Restore state for this mode
    if (state.roundActive === 'rolling') {
      showRolling();
      updateTimer(timerEl.textContent, 'rolling');
    } else if (state.roundActive === true) {
      updateTimer(timerEl.textContent, 'betting');
    } else {
      updateTimer(30, 'waiting');
    }
  }

  function resetDisplay() {
    diceResult.classList.remove('show');
    diceResult.textContent = '';
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

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  function getBetLabel(t) { return { odd: 'Четное', notodd: 'Нечетное' }[t] || t; }
  function getBetColor(t) {
    if (t === 'odd') return '#2196f3';
    if (t === 'notodd') return '#607d8b';
    return '#4caf50';
  }

  function updateBetsUI() {
    const state = getCurrentState();
    if (!state.bets.length) { activeBets.style.display = 'none'; return; }
    activeBets.style.display = 'flex';
    activeBetsList.innerHTML = '';
    const grouped = {};
    state.bets.forEach(b => {
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
    const state = getCurrentState();
    if (state.roundActive === 'rolling') return;

    const stake = parseFloat(stakeInput.value) || 0;
    if (stake < 0.1) { gameStatusEl.textContent = 'Мин. ставка $0.10'; gameStatusEl.className = 'game-status error'; return; }
    if (stake > 200) { gameStatusEl.textContent = 'Макс. ставка $200'; gameStatusEl.className = 'game-status error'; return; }
    const total = state.bets.reduce((s, b) => s + b.amount, 0);
    if (total + stake > getBalance()) { gameStatusEl.textContent = 'Недостаточно средств'; gameStatusEl.className = 'game-status error'; return; }
    if (PARITY.includes(type)) {
      const existing = state.bets.find(b => PARITY.includes(b.type));
      if (existing && existing.type !== type) {
        gameStatusEl.textContent = 'Только чет ИЛИ нечет!';
        gameStatusEl.className = 'game-status error';
        return;
      }
    }
     state.bets.push({ type, amount: stake });
     recordStat('bet', stake, `Dice ${getBetLabel(type)} ${currentMode}`);
     if(window.mcStats) mcStats.addBet(Math.abs(stake), 'Dice', `${getBetLabel(type)} (${currentMode})`);
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
    timerEl.classList.toggle('urgent', t <= 5 && phase !== 'waiting' && t > 0);
    if (phase === 'waiting') {
      gameStatusEl.textContent = 'Ожидание ставок...';
      gameStatusEl.className = 'game-status';
      document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
    } else if (phase === 'betting') {
      gameStatusEl.textContent = `Ставки... ${t}с`;
      gameStatusEl.className = 'game-status';
      document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
    } else if (phase === 'rolling') {
      gameStatusEl.textContent = 'Бросаем...';
      gameStatusEl.className = 'game-status';
      document.querySelectorAll('.bet-btn').forEach(b => b.disabled = true);
    }
  }

  function startLocalTimer(secs, phase, state) {
    if (state.localTimer) clearInterval(state.localTimer);
    state.roundActive = true;
    let t = secs;
    updateTimer(t, phase);
    state.localTimer = setInterval(() => {
      t--;
      if (t < 0) { clearInterval(state.localTimer); state.localTimer = null; return; }
      if (currentMode === state.mode) updateTimer(t, phase);
    }, 1000);
  }

  function stopLocalTimer(state) {
    if (state.localTimer) { clearInterval(state.localTimer); state.localTimer = null; }
  }

  function showResult(nums, resultData) {
    const sum = nums.reduce((a, b) => a + b, 0);
    const myWin = resultData ? resultData.win : 0;
    const myBet = resultData ? resultData.bet : 0;

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

  function setupSocket() {
    if (socket) socket.disconnect();
    socket = io({ query: { userId } });

    socket.on('connect', () => {
      gameStatusEl.textContent = 'Подключено';
      // Reset all states
      Object.keys(allStates).forEach(k => {
        allStates[k].roundActive = false;
        stopLocalTimer(allStates[k]);
      });
      updateTimer(30, 'waiting');
    });

    // Listen for ALL dice types
    ['1dice', '2dice', '3dice'].forEach(diceType => {
      const p = `dice:${diceType}`;
      const state = allStates[diceType];
      state.mode = diceType;

      socket.on(`${p}:state`, (data) => {
        state.bets = data.myBets || [];
        if (diceType === currentMode) {
          updateBetsUI();
          if (data.history) {
            historyScroll.innerHTML = '';
            data.history.forEach(h => addHistory(h.sum));
          }
          if (data.phase === 'betting' && data.timer > 0) {
            startLocalTimer(data.timer, 'betting', state);
          } else if (data.phase === 'waiting') {
            state.roundActive = false;
            stopLocalTimer(state);
            updateTimer(30, 'waiting');
          }
        }
      });

      socket.on(`${p}:timer`, (data) => {
        if (data.phase === 'betting') {
          startLocalTimer(data.timer, 'betting', state);
        }
      });

      socket.on(`${p}:betsUpdate`, (data) => {
        if (data.myBets) {
          state.bets = data.myBets;
          if (diceType === currentMode) updateBetsUI();
        }
        if (data.allBets && diceType === currentMode) updateAllBets(data.allBets);
      });

      socket.on(`${p}:roll`, (data) => {
        state.roundActive = 'rolling';
        stopLocalTimer(state);

        if (diceType === currentMode) {
          showRolling();
          gameStatusEl.textContent = 'Бросаем...';
          gameStatusEl.className = 'game-status';
          document.querySelectorAll('.bet-btn').forEach(b => b.disabled = true);

          setTimeout(() => {
            const nums = data.result.nums || [data.result.num];
            const myRes = (data.results && data.results[userId]) || { win: 0, bet: 0 };
            let totalBet = 0;
            state.bets.forEach(b => totalBet += b.amount);
             if (myRes.win > 0) {
               setBalance(getBalance() + myRes.win);
               recordStat('win', myRes.win, `Dice won ${currentMode}`);
               if(window.mcStats) mcStats.addWin(myRes.win, 'Dice', `Выигрыш: ${getBetLabel(state.bets[0]?.type)} (${currentMode})`);
             } else if (totalBet > 0) {
               recordStat('loss', totalBet, `Dice lost ${currentMode}`);
               if(window.mcStats) mcStats.addLoss(totalBet, 'Dice', `Проигрыш (${currentMode})`);
             }
             showResult(nums, { win: myRes.win, bet: totalBet });
            hashDisplay.style.display = 'block';
            hashValue.textContent = data.hash || '';
          }, 1500);

          setTimeout(() => {
            state.roundActive = false;
            document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
            winAnnounce.style.display = 'none';
          }, 5000);
        }
      });

      socket.on(`${p}:newRound`, (data) => {
        state.bets = [];
        state.roundActive = false;
        stopLocalTimer(state);

        if (diceType === currentMode) {
          updateBetsUI();
          allPlayersBets.style.display = 'none';
          winAnnounce.style.display = 'none';
          hashDisplay.style.display = 'none';
          gameStatusEl.textContent = 'Ожидание ставок...';
          gameStatusEl.className = 'game-status';
          document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
          resetDisplay();
          updateTimer(30, 'waiting');
        }
      });
    });
  }

  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const a = parseFloat(btn.dataset.amount);
      const c = parseFloat(stakeInput.value) || 0;
      stakeInput.value = Math.min(200, Math.max(0.1, c + a)).toFixed(2);
    });
  });
  halfBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.max(0.1, v / 2).toFixed(2); });
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
  switchMode('1dice');
});
