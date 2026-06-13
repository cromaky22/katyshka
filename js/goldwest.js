document.addEventListener('DOMContentLoaded', function(){
  // === STATS HELPER ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId, type, amount: Math.abs(amount), detail: detail || 'GoldWest'})
      }).catch(function(){});
    }catch(e){}
  }
  
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

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  function initAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} } }
  function tone(freq, type, dur, vol) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
    } catch(e) {}
  }
  function sfxClick(){ tone(400,'sine',0.05,0.03); }
  function sfxWin(){ tone(800,'square',0.1,0.05); setTimeout(()=>tone(1200,'sine',0.15,0.04),100); }
  function sfxLose(){ tone(100,'sawtooth',0.3,0.04); }
  function sfxCoin(){ tone(600,'sine',0.08,0.04); }

  function saveGame() {
    if (!gameActive) { localStorage.removeItem('gw_game'); return; }
    localStorage.setItem('gw_game', JSON.stringify({ bombs, level, openedCells, gameFields, currentCoef, stake }));
  }
  function loadGame() {
    const s = localStorage.getItem('gw_game');
    if (!s) return false;
    try {
      const d = JSON.parse(s);
      bombs=d.bombs; level=d.level; openedCells=d.openedCells; gameFields=d.gameFields; currentCoef=d.currentCoef; stake=d.stake;
      return gameActive = true;
    } catch(e) { localStorage.removeItem('gw_game'); return false; }
  }

  function renderLevels() {
    levelsArea.innerHTML = '';
    const coefs = genCoefs(bombs);
    const cpr = bombs === 1 ? 2 : 3;

    for (let i = 0; i < 10; i++) {
      const cur = i === level && gameActive;
      const opn = openedCells.includes(i);
      const row = document.createElement('div');
      row.className = 'gw-level' + (cur?' gw-level-current':'') + (opn?' gw-level-opened':'');

      const info = document.createElement('div');
      info.className = 'gw-level-info';
      info.innerHTML = `<span class="gw-level-num">${i+1} LVL</span><span class="gw-level-coef">x${coefs[i].toFixed(2)}</span>`;
      row.appendChild(info);

      const wrap = document.createElement('div');
      wrap.className = 'gw-cells';

      for (let j = 0; j < cpr; j++) {
        const cell = document.createElement('div');
        cell.className = 'gw-cell';
        cell.dataset.level = i;
        cell.dataset.cell = j;

        if (opn && gameFields[i] && gameFields[i][j] !== undefined) {
          cell.classList.add(gameFields[i][j] ? 'gw-cell-bomb' : 'gw-cell-coin');
          cell.innerHTML = gameFields[i][j] ? '💣' : '💰';
        } else if (cur) {
          cell.classList.add('gw-cell-closed');
          cell.innerHTML = '💰';
        } else {
          cell.classList.add('gw-cell-empty');
        }
        wrap.appendChild(cell);
      }
      row.appendChild(wrap);
      levelsArea.appendChild(row);
    }

    if (gameActive) {
      const r = levelsArea.children[level];
      if (r) {
        r.querySelectorAll('.gw-cell-closed').forEach((c, idx) => {
          c.onclick = () => { c.onclick = null; handleClick(level, idx); };
        });
      }
    }
  }

  function handleClick(lvl, ci) {
    if (!gameActive || lvl !== level) return;
    sfxClick();
    const bomb = gameFields[lvl][ci] === true;

    if (bomb) {
      sfxLose();
      openedCells.push(lvl);
      currentCoef = 0;
      gameActive = false;
      levelsArea.querySelectorAll('.gw-cell').forEach(c => {
        const cl = +c.dataset.level, ci2 = +c.dataset.cell;
        if (gameFields[cl] && gameFields[cl][ci2] === true) {
          c.classList.remove('gw-cell-closed','gw-cell-empty');
          c.classList.add('gw-cell-bomb');
          c.innerHTML = '💣';
        }
      });
      resultArea.style.display = 'flex';
       resultText.textContent = '💥 Бомба! Вы проиграли';
       resultText.style.color = '#f44336';
       recordStat('loss', stake, `GoldWest bomb at level ${lvl + 1}`);
       if(window.mcStats) mcStats.addLoss(Math.abs(stake), 'GoldWest', `Уровень ${lvl + 1}, ${bombs} бомб`);
      resultCoef.textContent = '';
      gameStatusEl.textContent = `Проиграно. Потеря: $${stake.toFixed(2)}`;
      gameStatusEl.className = 'gw-status error';
      stakePanel.style.display = '';
      playBtn.disabled = false;
      bombOptions.forEach(b => b.style.pointerEvents = '');
      collectBtn.style.display = 'none';
      renderLevels();
      saveGame();
    } else {
      sfxCoin();
      openedCells.push(lvl);
      const coefs = genCoefs(bombs);
      currentCoef = coefs[lvl];
      const rw = levelsArea.children[lvl];
      if (rw) rw.querySelectorAll('.gw-cell').forEach((c, idx) => {
        c.classList.remove('gw-cell-closed');
        c.classList.add(idx === ci ? 'gw-cell-coin' : 'gw-cell-empty');
        c.innerHTML = idx === ci ? '💰' : '';
      });
      gameStatusEl.textContent = `Уровень ${lvl+1} пройден! Выигрыш: $${(stake*currentCoef).toFixed(2)} (x${currentCoef.toFixed(2)})`;
      gameStatusEl.className = 'gw-status success';

      if (lvl >= 9) {
        gameActive = false;
     const win = Math.round(stake * currentCoef * 100) / 100;
     setBalance(getBalance() + win);
     recordStat('win', win, `GoldWest all levels x${currentCoef.toFixed(2)}`);
     if(window.mcStats) mcStats.addWin(win, 'GoldWest', `Уровень ${lvl + 1}, ${bombs} бомб`);
     sfxWin();
        resultArea.style.display = 'flex';
        resultText.textContent = `🏆 Все уровни! Выигрыш: $${win.toFixed(2)}`;
        resultText.style.color = '#4caf50';
        resultCoef.textContent = `x${currentCoef.toFixed(2)}`;
        gameStatusEl.textContent = `Поздравляем! $${win.toFixed(2)}!`;
        stakePanel.style.display = '';
        playBtn.disabled = false;
        bombOptions.forEach(b => b.style.pointerEvents = '');
        collectBtn.style.display = 'none';
        renderLevels();
        saveGame();
      } else {
        level++;
        collectBtn.style.display = '';
        renderLevels();
        saveGame();
      }
    }
  }

  function generateField() {
    const cpr = bombs === 1 ? 2 : 3;
    gameFields = [];
    for (let i = 0; i < 10; i++) {
      const row = new Array(cpr).fill(false);
      const pos = [];
      while (pos.length < bombs) {
        const p = Math.floor(Math.random() * cpr);
        if (pos.indexOf(p) === -1) pos.push(p);
      }
      pos.forEach(p => row[p] = true);
      gameFields.push(row);
    }
  }

  collectBtn.onclick = () => {
    if (currentCoef <= 0 || !gameActive) return;
    sfxWin(); gameActive = false;
     const win = Math.round(stake * currentCoef * 100) / 100;
     setBalance(getBalance() + win);
     recordStat('win', win, `GoldWest cashout x${currentCoef.toFixed(2)}`);
     if(window.mcStats) mcStats.addWin(win, 'GoldWest', `Кэш-аут уровень ${level + 1}, ${bombs} бомб`);
     resultArea.style.display = 'flex';
    resultText.textContent = `🎉 Выигрыш: $${win.toFixed(2)}`;
    resultText.style.color = '#4caf50';
    resultCoef.textContent = `x${currentCoef.toFixed(2)}`;
    gameStatusEl.textContent = `Забрали $${win.toFixed(2)}!`;
    gameStatusEl.className = 'gw-status success';
    stakePanel.style.display = '';
    playBtn.disabled = false;
    bombOptions.forEach(b => b.style.pointerEvents = '');
    collectBtn.style.display = 'none';
    setTimeout(() => { resultArea.style.display = 'none'; renderLevels(); }, 2000);
    saveGame();
  };

  playBtn.onclick = () => {
    initAudio();
    const s = parseFloat(stakeInput.value);
    if (isNaN(s) || s < 0.1) { gameStatusEl.textContent='Мин. ставка $0.10'; gameStatusEl.className='gw-status error'; return; }
    if (s > 200) { gameStatusEl.textContent='Макс. ставка $200'; gameStatusEl.className='gw-status error'; return; }
    if (getBalance() < s) { gameStatusEl.textContent='Недостаточно средств'; gameStatusEl.className='gw-status error'; return; }
     stake = s;
     setBalance(getBalance() - stake);
     recordStat('bet', stake, `GoldWest ${bombs} bombs`);
     if(window.mcStats) mcStats.addBet(Math.abs(stake), 'GoldWest', `${bombs} бомб`);
     gameActive = true; level = 0; openedCells = []; currentCoef = 1;
    generateField(); renderLevels(); saveGame();
    stakePanel.style.display = 'none';
    playBtn.disabled = true;
    bombOptions.forEach(b => b.style.pointerEvents = 'none');
    resultArea.style.display = 'none';
    collectBtn.style.display = 'none';
    gameStatusEl.textContent = 'Уровень 1. Выберите ячейку';
    gameStatusEl.className = 'gw-status';
  };

  bombOptions.forEach(opt => {
    opt.onclick = () => {
      if (gameActive) return;
      bombOptions.forEach(b => b.classList.remove('active'));
      opt.classList.add('active');
      bombs = +opt.dataset.bombs;
      level=0; openedCells=[]; gameFields=[]; currentCoef=1; stake=0; gameActive=false;
      resultArea.style.display='none'; collectBtn.style.display='none';
      stakePanel.style.display=''; playBtn.disabled=false;
      gameStatusEl.textContent=''; gameStatusEl.className='gw-status';
      renderLevels(); saveGame();
    };
  });

  quickBtns.forEach(b => b.onclick = () => {
    const a = +b.dataset.amount, c = +stakeInput.value || 0;
    stakeInput.value = Math.min(200, Math.max(0.1, c + a)).toFixed(2);
  });
  halfBtn.onclick = () => { const v=+stakeInput.value||0; stakeInput.value=Math.max(0.1,v/2).toFixed(2); };
  doubleBtn.onclick = () => { const v=+stakeInput.value||0; stakeInput.value=Math.min(200,v*2).toFixed(2); };

  document.addEventListener('click', () => initAudio(), { once: true });
  document.querySelectorAll('.balance-value').forEach(el => el.textContent = getBalance().toFixed(2));

  if (loadGame()) {
    bombOptions.forEach(b => { b.classList.toggle('active', +b.dataset.bombs === bombs); b.style.pointerEvents = 'none'; });
    stakePanel.style.display = 'none'; playBtn.disabled = true;
    collectBtn.style.display = openedCells.length > 0 ? '' : 'none';
    resultArea.style.display = 'none';
    gameStatusEl.textContent = `Уровень ${level+1}. Выберите ячейку`;
    gameStatusEl.className = 'gw-status';
    renderLevels();
  } else {
    renderLevels();
  }
});
