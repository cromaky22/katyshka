document.addEventListener('DOMContentLoaded', function(){
  const diceContainer = document.getElementById('diceContainer');
  const dice1 = document.getElementById('dice1');
  const dice2 = document.getElementById('dice2');
  const dice3 = document.getElementById('dice3');
  const diceWrapper1 = document.getElementById('diceWrapper1');
  const diceWrapper2 = document.getElementById('diceWrapper2');
  const diceWrapper3 = document.getElementById('diceWrapper3');
  const diceResult = document.getElementById('diceResult');
  const timerValueEl = document.getElementById('timerValue');
  const timerOverlay = document.getElementById('timerOverlay');
  const gameStatusEl = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const stakeInput = document.getElementById('stakeInput');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  const bettingGrid = document.getElementById('bettingGrid');
  const activeBets = document.getElementById('activeBets');
  const activeBetsList = document.getElementById('activeBetsList');
  const winAnnouncement = document.getElementById('winAnnouncement');
  const winTitle = document.getElementById('winTitle');
  const winDetails = document.getElementById('winDetails');
  const allPlayersBetsEl = document.getElementById('allPlayersBets');
  const allPlayersBetsList = document.getElementById('allPlayersBetsList');
  const hashDisplay = document.getElementById('hashDisplay');
  const hashValue = document.getElementById('hashValue');
  const modeBtns = document.querySelectorAll('.mode-btn');

  let currentMode = '1dice';
  let currentBets = [];
  let playerName = 'Player';
  let playerAvatar = '';
  let userId = 'user_' + Math.random().toString(36).substr(2, 9);
  let isRolling = false;
  let localTimer = null;
  let audioCtx = null;

  const DICE_FACES = ['one', 'two', 'three', 'four', 'five', 'six'];

  const BET_CONFIGS = {
    '1dice': [
      { type: 'odd', label: 'Четное', coef: 1.9, class: 'btn-odd' },
      { type: 'notodd', label: 'Нечетное', coef: 1.9, class: 'btn-notodd' },
      { type: '1', label: '1', coef: 5, class: 'btn-number' },
      { type: '2', label: '2', coef: 5, class: 'btn-number' },
      { type: '3', label: '3', coef: 5, class: 'btn-number' },
      { type: '4', label: '4', coef: 5, class: 'btn-number' },
      { type: '5', label: '5', coef: 5, class: 'btn-number' },
      { type: '6', label: '6', coef: 5, class: 'btn-number' }
    ],
    '2dice': [
      { type: 'odd', label: 'Четное', coef: 1.75, class: 'btn-odd' },
      { type: 'notodd', label: 'Нечетное', coef: 2.1, class: 'btn-notodd' },
      { type: '2', label: '2', coef: 34, class: 'btn-sum' },
      { type: '3', label: '3', coef: 17, class: 'btn-sum' },
      { type: '4', label: '4', coef: 11, class: 'btn-sum' },
      { type: '5', label: '5', coef: 8, class: 'btn-sum' },
      { type: '6', label: '6', coef: 6, class: 'btn-sum' },
      { type: '7', label: '7', coef: 6, class: 'btn-sum' },
      { type: '8', label: '8', coef: 6, class: 'btn-sum' },
      { type: '9', label: '9', coef: 8, class: 'btn-sum' },
      { type: '10', label: '10', coef: 11, class: 'btn-sum' },
      { type: '11', label: '11', coef: 17, class: 'btn-sum' },
      { type: '12', label: '12', coef: 34, class: 'btn-sum' }
    ],
    '3dice': [
      { type: 'odd', label: 'Четное', coef: 1.5, class: 'btn-odd' },
      { type: 'notodd', label: 'Нечетное', coef: 2.5, class: 'btn-notodd' },
      { type: '3', label: '3', coef: 216, class: 'btn-sum' },
      { type: '4', label: '4', coef: 72, class: 'btn-sum' },
      { type: '5', label: '5', coef: 36, class: 'btn-sum' },
      { type: '6', label: '6', coef: 21, class: 'btn-sum' },
      { type: '7', label: '7', coef: 14, class: 'btn-sum' },
      { type: '8', label: '8', coef: 10, class: 'btn-sum' },
      { type: '9', label: '9', coef: 8, class: 'btn-sum' },
      { type: '10', label: '10', coef: 7, class: 'btn-sum' },
      { type: '11', label: '11', coef: 7, class: 'btn-sum' },
      { type: '12', label: '12', coef: 8, class: 'btn-sum' },
      { type: '13', label: '13', coef: 10, class: 'btn-sum' },
      { type: '14', label: '14', coef: 14, class: 'btn-sum' },
      { type: '15', label: '15', coef: 21, class: 'btn-sum' },
      { type: '16', label: '16', coef: 36, class: 'btn-sum' },
      { type: '17', label: '17', coef: 72, class: 'btn-sum' },
      { type: '18', label: '18', coef: 216, class: 'btn-sum' }
    ]
  };

  function buildDiceFace(num) {
    const face = document.createElement('div');
    face.className = `face ${DICE_FACES[num - 1]}`;
    for (let i = 0; i < num; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      face.appendChild(dot);
    }
    return face;
  }

  function initDiceFaces() {
    [dice1, dice2, dice3].forEach(dice => {
      dice.innerHTML = '';
      for (let i = 1; i <= 6; i++) {
        dice.appendChild(buildDiceFace(i));
      }
    });
  }
  initDiceFaces();

  function setDiceValue(diceEl, value) {
    diceEl.classList.remove('rolling');
    diceEl.className = `dice show-${value}`;
  }

  function showRollingAnimation() {
    [dice1, dice2, dice3].forEach(dice => {
      dice.classList.remove('rolling');
      void dice.offsetWidth;
      dice.classList.add('rolling');
    });
  }

  function buildBettingGrid() {
    bettingGrid.innerHTML = '';
    const config = BET_CONFIGS[currentMode];
    
    if (currentMode === '1dice') {
      const row1 = document.createElement('div');
      row1.className = 'betting-row';
      config.slice(0, 2).forEach(bet => {
        row1.appendChild(createBetBtn(bet));
      });
      bettingGrid.appendChild(row1);
      
      const row2 = document.createElement('div');
      row2.className = 'betting-row';
      config.slice(2, 5).forEach(bet => {
        row2.appendChild(createBetBtn(bet));
      });
      bettingGrid.appendChild(row2);
      
      const row3 = document.createElement('div');
      row3.className = 'betting-row';
      config.slice(5).forEach(bet => {
        row3.appendChild(createBetBtn(bet));
      });
      bettingGrid.appendChild(row3);
    } else if (currentMode === '2dice') {
      const row1 = document.createElement('div');
      row1.className = 'betting-row';
      config.slice(0, 2).forEach(bet => {
        row1.appendChild(createBetBtn(bet));
      });
      bettingGrid.appendChild(row1);
      
      const row2 = document.createElement('div');
      row2.className = 'betting-row';
      config.slice(2, 6).forEach(bet => {
        row2.appendChild(createBetBtn(bet));
      });
      bettingGrid.appendChild(row2);
      
      const row3 = document.createElement('div');
      row3.className = 'betting-row';
      config.slice(6, 10).forEach(bet => {
        row3.appendChild(createBetBtn(bet));
      });
      bettingGrid.appendChild(row3);
      
      const row4 = document.createElement('div');
      row4.className = 'betting-row';
      config.slice(10).forEach(bet => {
        row4.appendChild(createBetBtn(bet));
      });
      bettingGrid.appendChild(row4);
    } else {
      const row1 = document.createElement('div');
      row1.className = 'betting-row';
      config.slice(0, 2).forEach(bet => {
        row1.appendChild(createBetBtn(bet));
      });
      bettingGrid.appendChild(row1);
      
      for (let i = 2; i < config.length; i += 4) {
        const row = document.createElement('div');
        row.className = 'betting-row';
        config.slice(i, i + 4).forEach(bet => {
          row.appendChild(createBetBtn(bet));
        });
        bettingGrid.appendChild(row);
      }
    }
  }

  function createBetBtn(bet) {
    const btn = document.createElement('button');
    btn.className = `bet-btn ${bet.class}`;
    btn.dataset.bet = bet.type;
    btn.innerHTML = `${bet.label}<div class="coef">x${bet.coef}</div>`;
    btn.addEventListener('click', () => addBet(bet.type));
    return btn;
  }

  function switchMode(mode) {
    currentMode = mode;
    currentBets = [];
    updateMyBetsDisplay();
    
    modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    diceWrapper1.classList.toggle('hidden', mode !== '1dice');
    diceWrapper2.classList.toggle('hidden', mode !== '2dice');
    diceWrapper3.classList.toggle('hidden', mode !== '3dice');
    
    if (mode === '1dice') {
      diceContainer.style.gap = '16px';
    } else if (mode === '2dice') {
      diceContainer.style.gap = '16px';
    } else {
      diceContainer.style.gap = '12px';
    }
    
    buildBettingGrid();
    resetDiceDisplay();
  }

  function resetDiceDisplay() {
    diceResult.classList.remove('show');
    diceResult.textContent = '';
    [dice1, dice2, dice3].forEach(dice => {
      dice.className = 'dice show-1';
    });
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  function initAudio() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  }
  function tone(freq, type, dur, vol) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(g).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function rollSfx() { tone(200 + Math.random() * 100, 'square', 0.08, 0.05); }
  function winSfx() { tone(800, 'square', 0.1, 0.05); setTimeout(() => tone(1200, 'sine', 0.15, 0.04), 100); }
  function loseSfx() { tone(100, 'sawtooth', 0.3, 0.04); }

  function getBalance() {
    let stored = localStorage.getItem('mc_balance');
    if (stored === null || stored === 'NaN') { stored = '100.00'; localStorage.setItem('mc_balance', stored); }
    const val = parseFloat(stored);
    if (isNaN(val) || val < 0.5) { localStorage.setItem('mc_balance', '100.00'); return 100; }
    return val;
  }
  function setBalance(v) {
    const n = Math.round(Number(v) * 100) / 100;
    if (isNaN(n)) return;
    localStorage.setItem('mc_balance', n.toFixed(2));
    document.querySelectorAll('.balance-value').forEach(el => el.textContent = n.toFixed(2));
  }

  function getBetLabel(type) {
    const map = { odd: 'Четное', notodd: 'Нечетное' };
    return map[type] || type;
  }

  function getBetColor(type) {
    if (type === 'odd') return '#2196f3';
    if (type === 'notodd') return '#607d8b';
    return '#4caf50';
  }

  function getBetCoef(type) {
    const config = BET_CONFIGS[currentMode];
    const bet = config.find(b => b.type === type);
    return bet ? bet.coef : 1;
  }

  function betWins(betType, diceValues) {
    const sum = diceValues.reduce((a, b) => a + b, 0);
    if (betType === 'odd') return sum % 2 === 0;
    if (betType === 'notodd') return sum % 2 !== 0;
    if (!isNaN(Number(betType))) return sum === Number(betType);
    return false;
  }

  function updateMyBetsDisplay() {
    if (currentBets.length === 0) { activeBets.style.display = 'none'; return; }
    activeBets.style.display = 'flex';
    activeBetsList.innerHTML = '';
    const grouped = {};
    currentBets.forEach(bet => {
      if (!grouped[bet.type]) grouped[bet.type] = { type: bet.type, amount: 0 };
      grouped[bet.type].amount += bet.amount;
    });
    Object.values(grouped).forEach(group => {
      const el = document.createElement('div');
      el.className = 'active-bet-item';
      el.style.background = getBetColor(group.type);
      el.innerHTML = `<span>${getBetLabel(group.type)}</span><span>$${group.amount.toFixed(2)}</span>`;
      activeBetsList.appendChild(el);
    });
  }

  function addBet(type) {
    if (isRolling) return;
    const stake = parseFloat(stakeInput.value) || 0;
    if (stake < 0.5) { gameStatusEl.textContent = 'Мин. ставка $0.50'; gameStatusEl.className = 'game-status error'; return; }
    if (stake > 200) { gameStatusEl.textContent = 'Макс. ставка $200'; gameStatusEl.className = 'game-status error'; return; }
    const totalCurrent = currentBets.reduce((s, b) => s + b.amount, 0);
    if (totalCurrent + stake > getBalance()) { gameStatusEl.textContent = 'Недостаточно средств'; gameStatusEl.className = 'game-status error'; return; }
    
    currentBets.push({ type, amount: stake });
    updateMyBetsDisplay();
    gameStatusEl.textContent = '';
    
    const diceType = currentMode === '1dice' ? 'dice' : currentMode === '2dice' ? 'dice2' : 'dice3';
    socket.emit('dice:bet', { type, amount: stake, diceType, playerName, playerAvatar });
  }

  function updateAllPlayersBets(allBets) {
    if (!allBets || allBets.length === 0) { allPlayersBetsEl.style.display = 'none'; return; }
    allPlayersBetsEl.style.display = 'flex';
    allPlayersBetsList.innerHTML = '';
    allBets.forEach(bet => {
      const el = document.createElement('div');
      el.className = 'player-bet-item';
      el.style.borderLeftColor = getBetColor(bet.type);
      const avatarHtml = bet.playerAvatar
        ? `<img class="player-bet-avatar" src="${bet.playerAvatar}" alt="" onerror="this.style.display='none'">`
        : `<div class="player-bet-avatar player-bet-avatar-empty">${(bet.playerName||'?')[0].toUpperCase()}</div>`;
      el.innerHTML = `<div class="player-bet-left">${avatarHtml}<div class="player-bet-info"><span class="player-bet-name">${bet.playerName||'Player'}</span><span class="player-bet-type">${getBetLabel(bet.type)}</span></div></div><span class="player-bet-amount">$${bet.amount.toFixed(2)}</span>`;
      allPlayersBetsList.appendChild(el);
    });
  }

  function addHistory(num, isEven) {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.style.backgroundColor = isEven ? '#2196f3' : '#607d8b';
    el.textContent = num;
    historyScroll.insertBefore(el, historyScroll.firstChild);
    while (historyScroll.children.length > 20) historyScroll.removeChild(historyScroll.lastChild);
  }

  function updateTimerDisplay(t, phase) {
    timerValueEl.textContent = t;
    timerValueEl.classList.toggle('urgent', t <= 5);
    if (phase === 'betting') {
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

  function showResult(diceValues, myWin, totalBet) {
    const sum = diceValues.reduce((a, b) => a + b, 0);
    const isEven = sum % 2 === 0;
    
    setDiceValue(dice1, diceValues[0]);
    if (diceValues[1]) setDiceValue(dice2, diceValues[1]);
    if (diceValues[2]) setDiceValue(dice3, diceValues[2]);
    
    diceResult.textContent = `Сумма: ${sum}`;
    diceResult.classList.add('show');
    
    addHistory(sum, isEven);
    
    winAnnouncement.style.display = 'flex';
    if (myWin > 0) {
      winTitle.textContent = '🎉 Вы выиграли!';
      winDetails.innerHTML = `<div class="win-row"><span>Выигрыш</span><span>+$${myWin.toFixed(2)}</span></div>`;
      winSfx();
    } else if (totalBet > 0) {
      winTitle.textContent = '😔 Вы проиграли';
      winDetails.innerHTML = `<div class="win-row lose"><span>Проигрыш</span><span>-$${totalBet.toFixed(2)}</span></div>`;
      loseSfx();
    } else {
      winTitle.textContent = 'Результат';
      winDetails.innerHTML = `<div class="win-row"><span>Сумма</span><span>${sum}</span></div>`;
    }
    
    gameStatusEl.textContent = `Выпало: ${sum} (${isEven ? 'Четное' : 'Нечетное'})`;
    gameStatusEl.className = myWin > 0 ? 'game-status success' : totalBet > 0 ? 'game-status error' : 'game-status';
  }

  const socket = io({ query: { userId } });

  socket.on('connect', () => { gameStatusEl.textContent = 'Подключено'; });

  socket.on('dice:state', (state) => {
    currentBets = state.myBets || [];
    updateMyBetsDisplay();
    if (state.history) state.history.forEach(h => addHistory(h.num, h.num % 2 === 0));
    if (state.phase === 'betting' && state.timer > 0) startLocalTimer(state.timer, 'betting');
  });

  socket.on('dice:timer', (data) => startLocalTimer(data.timer, data.phase));

  socket.on('dice:betsUpdate', (data) => {
    if (data.myBets) { currentBets = data.myBets; updateMyBetsDisplay(); }
    if (data.allBets) updateAllPlayersBets(data.allBets);
  });

  socket.on('dice:roll', (data) => {
    isRolling = true;
    document.querySelectorAll('.bet-btn').forEach(b => b.disabled = true);
    gameStatusEl.textContent = 'Бросаем...';
    
    showRollingAnimation();
    
    setTimeout(() => {
      const diceValues = data.result.nums || [data.result.num];
      let myWin = 0;
      let totalBet = 0;
      
      if (data.results && data.results[userId] !== undefined) {
        myWin = data.results[userId].win;
      }
      
      currentBets.forEach(bet => totalBet += bet.amount);
      
      if (myWin > 0) {
        setBalance(getBalance() + myWin);
      }
      
      showResult(diceValues, myWin, totalBet);
      
      hashDisplay.style.display = 'block';
      hashValue.textContent = data.hash || '';
      
      setTimeout(() => {
        isRolling = false;
        document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
        winAnnouncement.style.display = 'none';
      }, 3000);
    }, 1500);
  });

  socket.on('dice:newRound', (data) => {
    currentBets = [];
    updateMyBetsDisplay();
    allPlayersBetsEl.style.display = 'none';
    winAnnouncement.style.display = 'none';
    hashDisplay.style.display = 'none';
    gameStatusEl.textContent = 'Новый раунд! Делайте ставки';
    gameStatusEl.className = 'game-status';
    isRolling = false;
    document.querySelectorAll('.bet-btn').forEach(b => b.disabled = false);
    resetDiceDisplay();
  });

  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const a = parseFloat(btn.dataset.amount);
      const cur = parseFloat(stakeInput.value) || 0;
      stakeInput.value = Math.min(200, Math.max(0.5, cur + a)).toFixed(2);
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
});
