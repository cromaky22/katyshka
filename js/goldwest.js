document.addEventListener('DOMContentLoaded', function(){
  // === DOM ===
  const bombSelect = document.getElementById('bombSelect');
  const coefsRow = document.getElementById('coefsRow');
  const levelsArea = document.getElementById('levelsArea');
  const resultArea = document.getElementById('resultArea');
  const resultText = document.getElementById('resultText');
  const resultCoef = document.getElementById('resultCoef');
  const collectBtn = document.getElementById('collectBtn');
  const continueBtn = document.getElementById('continueBtn');
  const stakePanel = document.getElementById('stakePanel');
  const stakeInput = document.getElementById('stakeInput');
  const playBtn = document.getElementById('playBtn');
  const gameStatusEl = document.getElementById('gameStatus');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const quickBtns = document.querySelectorAll('.gw-quick-btn');
  const bombOptions = document.querySelectorAll('.gw-bomb-option');

  // === GAME STATE ===
  let bombs = 1;
  let level = 0;
  let openedCells = [];
  let gameFields = [];
  let currentCoef = 1;
  let stake = 0;
  let gameActive = false;
  let audioCtx = null;

  // === COEFS GENERATION ===
  function genCoefs(bombCount) {
    let a = 1, coefs = [];
    let i = 1, r = 2;
    if (bombCount === 2) { i = 2; r = 3; }
    for (let s = 0; s < 10; s++) {
      a *= 1 - i / r;
      let n = Math.floor((0.95 / a) * 100) / 100;
      coefs.push(n);
    }
    return coefs;
  }

  // === BALANCE ===
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

  // === AUDIO ===
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
  function sfxClick() { tone(400, 'sine', 0.05, 0.03); }
  function sfxWin() { tone(800, 'square', 0.1, 0.05); setTimeout(() => tone(1200, 'sine', 0.15, 0.04), 100); }
  function sfxLose() { tone(100, 'sawtooth', 0.3, 0.04); }
  function sfxCoin() { tone(600, 'sine', 0.08, 0.04); }

  // === RENDER COEFS ===
  function renderCoefs() {
    const coefs = genCoefs(bombs);
    coefsRow.innerHTML = '';
    coefs.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'gw-coef-item';
      el.innerHTML = `<span class="gw-coef-lvl">${i + 1} Hit</span><span class="gw-coef-val">x${c.toFixed(2)}</span>`;
      coefsRow.appendChild(el);
    });
  }

  // === RENDER LEVELS ===
  function renderLevels() {
    levelsArea.innerHTML = '';
    const coefs = genCoefs(bombs);
    const cellsPerRow = bombs === 1 ? 2 : 3;

    for (let i = 0; i < 10; i++) {
      const isCurrent = i === level && gameActive;
      const isOpened = openedCells.includes(i);
      const row = document.createElement('div');
      row.className = 'gw-level' + (isCurrent ? ' gw-level-current' : '') + (isOpened ? ' gw-level-opened' : '');

      // Level info
      const info = document.createElement('div');
      info.className = 'gw-level-info';
      info.innerHTML = `<span class="gw-level-num">${i + 1} LVL</span><span class="gw-level-coef">x${coefs[i].toFixed(2)}</span>`;
      row.appendChild(info);

      // Cells
      const cellsWrap = document.createElement('div');
      cellsWrap.className = 'gw-cells';

      for (let j = 0; j < cellsPerRow; j++) {
        const cell = document.createElement('div');
        cell.className = 'gw-cell';
        cell.dataset.level = i;
        cell.dataset.cell = j;

        if (isOpened && gameFields[i] && gameFields[i][j] !== undefined) {
          if (gameFields[i][j] === true) {
            // Bomb
            cell.classList.add('gw-cell-bomb');
            cell.innerHTML = '💣';
          } else {
            // Coin
            cell.classList.add('gw-cell-coin');
            cell.innerHTML = '💰';
          }
        } else if (isCurrent && !isOpened) {
          cell.classList.add('gw-cell-closed');
          cell.innerHTML = '💰';
          cell.addEventListener('click', () => openCell(i, j));
        }

        cellsWrap.appendChild(cell);
      }

      row.appendChild(cellsWrap);
      levelsArea.appendChild(row);
    }
  }

  // === OPEN CELL ===
  function openCell(lvl, cellIdx) {
    if (!gameActive || lvl !== level) return;
    sfxClick();

    // Check if bomb
    const isBomb = gameFields[lvl][cellIdx] === true;

    if (isBomb) {
      // Game over
      sfxLose();
      openedCells.push(lvl);
      currentCoef = 0;
      gameActive = false;

      // Show all bombs
      revealAllBombs();

      resultArea.style.display = 'flex';
      resultText.textContent = '💥 Бомба! Вы проиграли';
      resultText.style.color = '#f44336';
      resultCoef.textContent = '';

      gameStatusEl.textContent = `Проиграно. Потеря: $${stake.toFixed(2)}`;
      gameStatusEl.className = 'gw-status error';

      stakePanel.style.display = '';
      playBtn.disabled = false;
      collectBtn.style.display = 'none';
      continueBtn.style.display = 'none';
    } else {
      // Coin - win this level
      sfxCoin();
      openedCells.push(lvl);
      const coefs = genCoefs(bombs);
      currentCoef = coefs[lvl];

      renderLevels();

      // Show collect button
      collectBtn.style.display = '';
      continueBtn.style.display = '';

      gameStatusEl.textContent = `Уровень ${lvl + 1} пройден! Выигрыш: $${(stake * currentCoef).toFixed(2)} (x${currentCoef.toFixed(2)})`;
      gameStatusEl.className = 'gw-status success';
    }
  }

  // === REVEAL ALL BOMBS ===
  function revealAllBombs() {
    const cells = document.querySelectorAll('.gw-cell');
    cells.forEach(cell => {
      const lvl = parseInt(cell.dataset.level);
      const idx = parseInt(cell.dataset.cell);
      if (gameFields[lvl] && gameFields[lvl][idx] === true) {
        cell.classList.add('gw-cell-bomb');
        cell.innerHTML = '💣';
      }
    });
  }

  // === GENERATE FIELD ===
  function generateField() {
    const cellsPerRow = bombs === 1 ? 2 : 3;
    gameFields = [];
    for (let i = 0; i < 10; i++) {
      const row = new Array(cellsPerRow).fill(false);
      // Place bombs randomly
      const bombPositions = [];
      while (bombPositions.length < bombs) {
        const pos = Math.floor(Math.random() * cellsPerRow);
        if (bombPositions.indexOf(pos) === -1) bombPositions.push(pos);
      }
      bombPositions.forEach(pos => row[pos] = true);
      gameFields.push(row);
    }
  }

  // === COLLECT ===
  collectBtn.addEventListener('click', () => {
    if (currentCoef <= 0) return;
    sfxWin();
    const winAmount = Math.round(stake * currentCoef * 100) / 100;
    setBalance(getBalance() + winAmount);

    resultArea.style.display = 'flex';
    resultText.textContent = `🎉 Выигрыш: $${winAmount.toFixed(2)}`;
    resultText.style.color = '#4caf50';
    resultCoef.textContent = `x${currentCoef.toFixed(2)}`;

    gameStatusEl.textContent = `Забрали $${winAmount.toFixed(2)}!`;
    gameStatusEl.className = 'gw-status success';

    resetGame();
  });

  // === CONTINUE ===
  continueBtn.addEventListener('click', () => {
    sfxClick();
    level++;
    if (level >= 10) {
      // All levels passed - auto collect
      const coefs = genCoefs(bombs);
      currentCoef = coefs[9];
      const winAmount = Math.round(stake * currentCoef * 100) / 100;
      setBalance(getBalance() + winAmount);
      sfxWin();

      resultArea.style.display = 'flex';
      resultText.textContent = `🏆 Все уровни пройдены! Выигрыш: $${winAmount.toFixed(2)}`;
      resultText.style.color = '#4caf50';
      resultCoef.textContent = `x${currentCoef.toFixed(2)}`;

      gameStatusEl.textContent = `Поздравляем! Выиграли $${winAmount.toFixed(2)}!`;
      gameStatusEl.className = 'gw-status success';

      resetGame();
    } else {
      renderLevels();
      collectBtn.style.display = 'none';
      continueBtn.style.display = 'none';
      gameStatusEl.textContent = `Уровень ${level + 1}. Выберите ячейку`;
      gameStatusEl.className = 'gw-status';
    }
  });

  // === RESET GAME ===
  function resetGame() {
    level = 0;
    openedCells = [];
    gameFields = [];
    currentCoef = 1;
    gameActive = false;
    stake = 0;

    stakePanel.style.display = '';
    playBtn.disabled = false;
    bombOptions.forEach(b => b.style.pointerEvents = '');
    collectBtn.style.display = 'none';
    continueBtn.style.display = 'none';

    setTimeout(() => {
      resultArea.style.display = 'none';
      renderLevels();
    }, 2000);
  }

  // === PLAY ===
  playBtn.addEventListener('click', () => {
    initAudio();
    const s = parseFloat(stakeInput.value);
    if (isNaN(s) || s < 0.5) { gameStatusEl.textContent = 'Мин. ставка $0.50'; gameStatusEl.className = 'gw-status error'; return; }
    if (s > 200) { gameStatusEl.textContent = 'Макс. ставка $200'; gameStatusEl.className = 'gw-status error'; return; }
    if (getBalance() < s) { gameStatusEl.textContent = 'Недостаточно средств'; gameStatusEl.className = 'gw-status error'; return; }

    stake = s;
    setBalance(getBalance() - stake);
    gameActive = true;
    level = 0;
    openedCells = [];
    currentCoef = 1;

    generateField();
    renderLevels();

    stakePanel.style.display = 'none';
    playBtn.disabled = true;
    bombOptions.forEach(b => b.style.pointerEvents = 'none');
    resultArea.style.display = 'none';
    collectBtn.style.display = 'none';
    continueBtn.style.display = 'none';

    gameStatusEl.textContent = `Уровень 1. Выберите ячейку`;
    gameStatusEl.className = 'gw-status';
  });

  // === BOMB SELECT ===
  bombOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      if (gameActive) return;
      bombOptions.forEach(b => b.classList.remove('active'));
      opt.classList.add('active');
      bombs = parseInt(opt.dataset.bombs);
      renderCoefs();
    });
  });

  // === QUICK BETS ===
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const a = parseFloat(btn.dataset.amount);
      const cur = parseFloat(stakeInput.value) || 0;
      stakeInput.value = Math.min(200, Math.max(0.5, cur + a)).toFixed(2);
    });
  });

  halfBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.max(0.5, v / 2).toFixed(2); });
  doubleBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.min(200, v * 2).toFixed(2); });

  // === INIT ===
  document.addEventListener('click', () => initAudio(), { once: true });
  document.querySelectorAll('.balance-value').forEach(el => el.textContent = getBalance().toFixed(2));
  renderCoefs();
  renderLevels();
});
