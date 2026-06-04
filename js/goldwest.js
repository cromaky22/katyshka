document.addEventListener('DOMContentLoaded', function(){
  const bombSelect = document.getElementById('bombSelect');
  const levelsArea = document.getElementById('levelsArea');
  const resultArea = document.getElementById('resultArea');
  const resultText = document.getElementById('resultText');
  const resultCoef = document.getElementById('resultCoef');
  const collectBtn = document.getElementById('collectBtn');
  const stakePanel = document.getElementById('stakePanel');
  const stakeInput = document.getElementById('stakeInput');
  const playBtn = document.getElementById('playBtn');
  const gameStatusEl = document.getElementById('gameStatus');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const quickBtns = document.querySelectorAll('.gw-quick-btn');
  const bombOptions = document.querySelectorAll('.gw-bomb-option');

  let bombs = 1;
  let level = 0;
  let openedCells = [];
  let gameFields = [];
  let currentCoef = 1;
  let stake = 0;
  let gameActive = false;
  let audioCtx = null;

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

  function initAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } }
  function tone(freq, type, dur, vol) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(g).connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function sfxClick() { tone(400, 'sine', 0.05, 0.03); }
  function sfxWin() { tone(800, 'square', 0.1, 0.05); setTimeout(() => tone(1200, 'sine', 0.15, 0.04), 100); }
  function sfxLose() { tone(100, 'sawtooth', 0.3, 0.04); }
  function sfxCoin() { tone(600, 'sine', 0.08, 0.04); }

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

      const info = document.createElement('div');
      info.className = 'gw-level-info';
      info.innerHTML = `<span class="gw-level-num">${i + 1} LVL</span><span class="gw-level-coef">x${coefs[i].toFixed(2)}</span>`;
      row.appendChild(info);

      const cellsWrap = document.createElement('div');
      cellsWrap.className = 'gw-cells';

      for (let j = 0; j < cellsPerRow; j++) {
        const cell = document.createElement('div');
        cell.className = 'gw-cell';
        cell.dataset.level = i;
        cell.dataset.cell = j;

        if (isOpened && gameFields[i] && gameFields[i][j] !== undefined) {
          if (gameFields[i][j] === true) {
            cell.classList.add('gw-cell-bomb');
            cell.innerHTML = '💣';
          } else {
            cell.classList.add('gw-cell-coin');
            cell.innerHTML = '💰';
          }
        } else if (isCurrent && !isOpened) {
          cell.classList.add('gw-cell-closed');
          cell.innerHTML = '💰';
        } else {
          cell.classList.add('gw-cell-empty');
        }

        cellsWrap.appendChild(cell);
      }
      row.appendChild(cellsWrap);
      levelsArea.appendChild(row);
    }

    // Attach click handlers to current level cells
    if (gameActive) {
      const currentRow = levelsArea.children[level];
      if (currentRow) {
        const cells = currentRow.querySelectorAll('.gw-cell-closed');
        cells.forEach((cell, idx) => {
          cell.addEventListener('click', function handler() {
            cell.removeEventListener('click', handler);
            handleCellClick(level, idx);
          });
        });
      }
    }
  }

  // === HANDLE CELL CLICK ===
  function handleCellClick(lvl, cellIdx) {
    if (!gameActive || lvl !== level) return;
    sfxClick();

    const isBomb = gameFields[lvl][cellIdx] === true;

    if (isBomb) {
      // Game over
      sfxLose();
      openedCells.push(lvl);
      currentCoef = 0;
      gameActive = false;

      // Reveal all bombs
      const allCells = levelsArea.querySelectorAll('.gw-cell');
      allCells.forEach(c => {
        const cl = parseInt(c.dataset.level);
        const ci = parseInt(c.dataset.cell);
        if (gameFields[cl] && gameFields[cl][ci] === true) {
          c.classList.remove('gw-cell-closed', 'gw-cell-empty');
          c.classList.add('gw-cell-bomb');
          c.innerHTML = '💣';
        }
      });

      resultArea.style.display = 'flex';
      resultText.textContent = '💥 Бомба! Вы проиграли';
      resultText.style.color = '#f44336';
      resultCoef.textContent = '';
      gameStatusEl.textContent = `Проиграно. Потеря: $${stake.toFixed(2)}`;
      gameStatusEl.className = 'gw-status error';

      stakePanel.style.display = '';
      playBtn.disabled = false;
      bombOptions.forEach(b => b.style.pointerEvents = '');
      collectBtn.style.display = 'none';
      renderLevels();
    } else {
      // Coin - level passed
      sfxCoin();
      openedCells.push(lvl);
      const coefs = genCoefs(bombs);
      currentCoef = coefs[lvl];

      // Show coin in clicked cell
      const currentRow = levelsArea.children[lvl];
      if (currentRow) {
        const cells = currentRow.querySelectorAll('.gw-cell');
        cells.forEach((c, idx) => {
          if (idx === cellIdx) {
            c.classList.remove('gw-cell-closed');
            c.classList.add('gw-cell-coin');
            c.innerHTML = '💰';
          } else {
            c.classList.remove('gw-cell-closed', 'gw-cell-empty');
            c.classList.add('gw-cell-empty');
            c.innerHTML = '';
          }
        });
      }

      gameStatusEl.textContent = `Уровень ${lvl + 1} пройден! Выигрыш: $${(stake * currentCoef).toFixed(2)} (x${currentCoef.toFixed(2)})`;
      gameStatusEl.className = 'gw-status success';

      // Check if all levels passed
      if (lvl >= 9) {
        gameActive = false;
        const winAmount = Math.round(stake * currentCoef * 100) / 100;
        setBalance(getBalance() + winAmount);
        sfxWin();

        resultArea.style.display = 'flex';
        resultText.textContent = `🏆 Все уровни пройдены! Выигрыш: $${winAmount.toFixed(2)}`;
        resultText.style.color = '#4caf50';
        resultCoef.textContent = `x${currentCoef.toFixed(2)}`;
        gameStatusEl.textContent = `Поздравляем! Выиграли $${winAmount.toFixed(2)}!`;
        gameStatusEl.className = 'gw-status success';

        stakePanel.style.display = '';
        playBtn.disabled = false;
        bombOptions.forEach(b => b.style.pointerEvents = '');
        collectBtn.style.display = 'none';
        renderLevels();
      } else {
        // Auto advance to next level
        level++;
        collectBtn.style.display = '';
        renderLevels();
      }
    }
  }

  // === GENERATE FIELD ===
  function generateField() {
    const cellsPerRow = bombs === 1 ? 2 : 3;
    gameFields = [];
    for (let i = 0; i < 10; i++) {
      const row = new Array(cellsPerRow).fill(false);
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
    if (currentCoef <= 0 || !gameActive) return;
    sfxWin();
    gameActive = false;
    const winAmount = Math.round(stake * currentCoef * 100) / 100;
    setBalance(getBalance() + winAmount);

    resultArea.style.display = 'flex';
    resultText.textContent = `🎉 Выигрыш: $${winAmount.toFixed(2)}`;
    resultText.style.color = '#4caf50';
    resultCoef.textContent = `x${currentCoef.toFixed(2)}`;
    gameStatusEl.textContent = `Забрали $${winAmount.toFixed(2)}!`;
    gameStatusEl.className = 'gw-status success';

    stakePanel.style.display = '';
    playBtn.disabled = false;
    bombOptions.forEach(b => b.style.pointerEvents = '');
    collectBtn.style.display = 'none';

    setTimeout(() => { resultArea.style.display = 'none'; renderLevels(); }, 2000);
  });

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
    gameStatusEl.textContent = 'Уровень 1. Выберите ячейку';
    gameStatusEl.className = 'gw-status';
  });

  // === BOMB SELECT ===
  bombOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      if (gameActive) return;
      bombOptions.forEach(b => b.classList.remove('active'));
      opt.classList.add('active');
      bombs = parseInt(opt.dataset.bombs);
      renderLevels();
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
  renderLevels();
});
