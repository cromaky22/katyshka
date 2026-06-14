document.addEventListener('DOMContentLoaded', function(){
  // === STATS HELPER ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      const data = {userId, type, amount: Math.abs(amount), detail: detail || 'Double'};
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      }).catch(function(){});
    }catch(e){}
  }
  
  const canvas = document.getElementById('doubleWheel');
  const ctx = canvas.getContext('2d');
  const resultLens = document.getElementById('resultLens');
  const stakeInput = document.getElementById('stakeInput');
  const playBtn = document.getElementById('playBtn');
  const gameStatusEl = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const betBtns = document.querySelectorAll('.bet-btn');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');

  // === СЕГМЕНТЫ ===
  const SEG_DEF = [
    { num: 2,  color: '#3498db', label: 'x2',  name: 'blue',   count: 24 },
    { num: 3,  color: '#f39c12', label: 'x3',  name: 'yellow', count: 15 },
    { num: 5,  color: '#e74c3c', label: 'x5',  name: 'orange', count: 8  },
    { num: 50, color: '#2ecc71', label: 'x50', name: 'green',  count: 1  },
  ];

  // Создаём массив 48 сегментов с равномерным распределением
  const wheelData = [];
  const TOTAL = SEG_DEF.reduce((s, seg) => s + seg.count, 0);
  const ANGLE = 360 / TOTAL;

  // Заполняем позиции равномерно
  const positions = new Array(TOTAL).fill(null);
  let posIdx = 0;
  SEG_DEF.forEach(seg => {
    const step = TOTAL / seg.count;
    for (let i = 0; i < seg.count; i++) {
      let slot = Math.round(i * step + step / 2) % TOTAL;
      while (positions[slot] !== null) slot = (slot + 1) % TOTAL;
      positions[slot] = { num: seg.num, color: seg.color, label: seg.label, name: seg.name };
    }
  });
  wheelData.push(...positions);

  let selectedColor = 'blue';
  let spinning = false;
  let rotation = 0;
  let audioCtx = null;

  // === CANVAS ===
  const dpr = window.devicePixelRatio || 1;
  const displaySize = 260;
  canvas.width = displaySize * dpr;
  canvas.height = displaySize * dpr;
  canvas.style.width = displaySize + 'px';
  canvas.style.height = displaySize + 'px';
  ctx.scale(dpr, dpr);
  const CX = displaySize / 2, CY = displaySize / 2, R = displaySize / 2 - 4;

  function drawWheel() {
    ctx.clearRect(0, 0, 600, 600);
    for (let i = 0; i < TOTAL; i++) {
      const seg = wheelData[i];
      const startAngle = (i * ANGLE - 90 + rotation) * Math.PI / 180;
      const endAngle = ((i + 1) * ANGLE - 90 + rotation) * Math.PI / 180;

      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + R * Math.cos(startAngle), CY + R * Math.sin(startAngle));
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate((startAngle + endAngle) / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 2;
      ctx.fillText(seg.label, R * 0.72, 0);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(CX, CY, R * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  drawWheel();

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
  function tickSfx() { tone(600 + Math.random() * 300, 'sine', 0.04, 0.03); }
  function winSfx() { tone(800, 'square', 0.1, 0.05); setTimeout(() => tone(1200, 'sine', 0.15, 0.04), 100); }
  function loseSfx() { tone(100, 'sawtooth', 0.3, 0.04); }

  // === BALANCE ===
  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  // === BETS ===
  betBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (spinning) return;
      betBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });
  betBtns[0].classList.add('selected');

  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const a = parseFloat(btn.dataset.amount);
      const cur = parseFloat(stakeInput.value) || 0;
      stakeInput.value = Math.min(200, Math.max(0.1, cur + a)).toFixed(2);
    });
  });
  halfBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.max(0.1, v / 2).toFixed(2); });
  doubleBtn.addEventListener('click', () => { const v = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.min(200, v * 2).toFixed(2); });

  // === SPIN ===
  function resultAtPointer() {
    const norm = ((-rotation % 360) + 360) % 360;
    const idx = Math.floor(norm / ANGLE) % TOTAL;
    return wheelData[idx];
  }

  function spinToTarget(targetIdx, dur, done) {
    const desiredNorm = (targetIdx * ANGLE + ANGLE / 2) % 360;
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
      const seg = Math.floor(norm / ANGLE);
      if (seg !== lastTick && p < 0.9) { lastTick = seg; tickSfx(); }
      if (p < 1) requestAnimationFrame(tick);
      else { rotation = startRot - totalRot; drawWheel(); done(); }
    }
    requestAnimationFrame(tick);
  }

  function addHistory(num, color) {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.style.backgroundColor = color;
    el.textContent = 'x' + num;
    historyScroll.insertBefore(el, historyScroll.firstChild);
    while (historyScroll.children.length > 20) historyScroll.removeChild(historyScroll.lastChild);
  }

  playBtn.addEventListener('click', () => {
    initAudio();
    if (spinning) return;
    const stake = parseFloat(stakeInput.value);
    if (isNaN(stake) || stake < 0.1) { gameStatusEl.textContent = 'Мин. ставка $0.10'; gameStatusEl.className = 'game-status error'; return; }
    if (stake > 200) { gameStatusEl.textContent = 'Макс. ставка $200'; gameStatusEl.className = 'game-status error'; return; }
    if (getBalance() < stake) { gameStatusEl.textContent = 'Недостаточно средств'; gameStatusEl.className = 'game-status error'; return; }

    spinning = true;
    playBtn.disabled = true;
    betBtns.forEach(b => b.disabled = true);
      setBalance(getBalance() - stake);
     recordStat('bet', stake, `Double ${selectedColor}`);
     if(window.mcStats) mcStats.addBet(Math.abs(stake), 'Double', `Цвет: ${selectedColor}`);
     var _u = (window.Balance && window.Balance.getUserId()) || localStorage.getItem('tg_uid') || '';
     if(_u) fetch('/api/wager/bet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:_u,amount:Math.abs(stake)})});
     resultLens.classList.remove('show');
    gameStatusEl.textContent = '';

    const target = Math.floor(Math.random() * TOTAL);
    spinToTarget(target, 4200, () => {
      const res = resultAtPointer();
      const won = res.name === selectedColor;
      const winAmt = won ? Math.round(stake * res.num * 100) / 100 : 0;

       if (won) {
         setBalance(getBalance() + winAmt);
         recordStat('win', winAmt, `Double won x${res.num}`);
         if(window.mcStats) mcStats.addWin(winAmt, 'Double', `Выпало x${res.num} (${res.name})`);
         gameStatusEl.textContent = `Выиграли $${winAmt.toFixed(2)}!`;
        gameStatusEl.className = 'game-status success';
        winSfx();
       } else {
         gameStatusEl.textContent = `Проиграло. Выпало ${res.label}`;
         recordStat('loss', stake, `Double lost ${res.label}`);
         if(window.mcStats) mcStats.addLoss(Math.abs(stake), 'Double', `Выпало ${res.label}`);
         gameStatusEl.className = 'game-status error';
        loseSfx();
      }

      resultLens.textContent = res.label;
      resultLens.style.backgroundColor = res.color;
      resultLens.style.boxShadow = `0 0 26px ${res.color}99, 0 6px 18px rgba(0,0,0,0.5)`;
      resultLens.classList.remove('show');
      void resultLens.offsetWidth;
      resultLens.classList.add('show');
      addHistory(res.num, res.color);

      setTimeout(() => {
        spinning = false;
        playBtn.disabled = false;
        betBtns.forEach(b => b.disabled = false);
      }, 2200);
    });
  });

  document.addEventListener('click', () => initAudio(), { once: true });
  document.querySelectorAll('.balance-value').forEach(el => el.textContent = getBalance().toFixed(2));
});
