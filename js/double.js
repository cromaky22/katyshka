document.addEventListener('DOMContentLoaded', function(){
  const canvas = document.getElementById('doubleWheel');
  const resultDisplay = document.getElementById('resultDisplay');
  const stakeInput = document.getElementById('stakeInput');
  const playBtn = document.getElementById('playBtn');
  const gameStatusEl = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const betBtns = document.querySelectorAll('.bet-btn');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const SEGMENTS = [
    { num: 2, color: '#3498db', label: 'x2', name: 'blue' },
    { num: 3, color: '#f39c12', label: 'x3', name: 'yellow' },
    { num: 5, color: '#e74c3c', label: 'x5', name: 'orange' },
    { num: 50, color: '#1abc9c', label: 'x50', name: 'teal' },
    { num: 50, color: '#2ecc71', label: 'x50', name: 'green' },
  ];

  const TOTAL_SEGMENTS = SEGMENTS.length;
  const SEGMENT_ANGLE = 360 / TOTAL_SEGMENTS;

  let selectedBet = null;
  let selectedColor = null;
  let gameActive = false;
  let history = [];
  let rotation = 0;
  let soundEnabled = true;
  let audioCtx = null;
  const baseSize = 340;

  function initAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { soundEnabled = false; }
    }
  }

  function playTone(freq, type, duration, vol = 0.06) {
    if (!soundEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function sfxTick() { playTone(600 + Math.random() * 300, 'sine', 0.04, 0.03); }
  function sfxWin() { playTone(800, 'square', 0.1, 0.05); playTone(1200, 'sine', 0.15, 0.04); }
  function sfxLose() { playTone(100, 'sawtooth', 0.3, 0.04); }

  function getBalance(){ 
    return parseFloat(localStorage.getItem('mc_balance') || '0') || 0; 
  }
  function setBalance(v){ 
    const n = Math.round(Number(v) * 100) / 100; 
    localStorage.setItem('mc_balance', n.toFixed(2)); 
    document.querySelectorAll('.balance-value').forEach(el=>el.textContent = n.toFixed(2)); 
  }

  canvas.width = baseSize * dpr;
  canvas.height = baseSize * dpr;
  ctx.scale(dpr, dpr);
  const size = baseSize;

  function drawWheel() {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.translate(cx, cy);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-cx, -cy);

    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      const startAngle = (i * SEGMENT_ANGLE - 90) * Math.PI / 180;
      const endAngle = ((i + 1) * SEGMENT_ANGLE - 90) * Math.PI / 180;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENTS[i].color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      const midAngle = (startAngle + endAngle) / 2;
      ctx.rotate(midAngle);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Inter, Arial, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.fillText(SEGMENTS[i].label, radius * 0.70, 4);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  betBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameActive) return;
      betBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedBet = parseInt(btn.dataset.multiplier);
      selectedColor = btn.dataset.color;
    });
  });

  if (betBtns[0]) betBtns[0].classList.add('selected');
  selectedBet = 2;
  selectedColor = 'blue';

  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      const currentValue = parseFloat(stakeInput.value) || 0;
      const newValue = currentValue + amount;
      stakeInput.value = Math.min(200, Math.max(0.5, newValue)).toFixed(2);
    });
  });

  halfBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.max(0.5, val / 2);
  });

  doubleBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.min(200, val * 2);
  });

  function spinToIndex(targetIndex, duration, onComplete) {
    const startRotation = rotation;
    const targetSegmentCenter = targetIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const targetAngle = (360 - targetSegmentCenter) % 360;
    const totalRotation = 360 * 7 + targetAngle;
    const startTime = Date.now();
    let lastSegmentPassed = -1;

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      rotation = startRotation + totalRotation * eased;

      drawWheel();

      const normalizedRot = ((rotation % 360) + 360) % 360;
      const currentSegment = Math.floor(normalizedRot / SEGMENT_ANGLE);
      if (currentSegment !== lastSegmentPassed && progress < 0.9) {
        lastSegmentPassed = currentSegment;
        sfxTick();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        rotation = rotation % 360;
        onComplete();
      }
    }

    requestAnimationFrame(animate);
  }

  function getResultAtPointer() {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const segmentIndex = Math.floor(normalizedRotation / SEGMENT_ANGLE);
    return SEGMENTS[segmentIndex];
  }

  function addHistoryItem(num, color) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.backgroundColor = color;
    item.textContent = 'x' + num;
    historyScroll.insertBefore(item, historyScroll.firstChild);
    while(historyScroll.children.length > 20){
      historyScroll.removeChild(historyScroll.lastChild);
    }
  }

  playBtn.addEventListener('click', () => {
    initAudio();
    if (gameActive) return;
    if (selectedBet === null) {
      gameStatusEl.textContent = 'Выберите цвет/множитель';
      gameStatusEl.className = 'game-status error';
      return;
    }

    const stake = parseFloat(stakeInput.value);
    if (isNaN(stake) || stake <= 0) {
      gameStatusEl.textContent = 'Введите корректную ставку';
      gameStatusEl.className = 'game-status error';
      return;
    }

    const balance = getBalance();
    if (balance < stake) {
      gameStatusEl.textContent = 'Недостаточно средств';
      gameStatusEl.className = 'game-status error';
      return;
    }

    gameActive = true;
    playBtn.disabled = true;
    setBalance(getBalance() - stake);
    resultDisplay.style.display = 'none';
    gameStatusEl.textContent = '';

    const targetIndex = Math.floor(Math.random() * TOTAL_SEGMENTS);
    spinToIndex(targetIndex, 4000, () => {
      const result = getResultAtPointer();
      const win = (result.name === selectedColor);
      const winAmount = win ? Math.round(stake * result.num * (1 - 0.06) * 100) / 100 : 0;

      if (win) {
        setBalance(getBalance() + winAmount);
        gameStatusEl.textContent = `Вы выиграли $${winAmount.toFixed(2)}! ✓`;
        gameStatusEl.className = 'game-status success';
        sfxWin();
      } else {
        gameStatusEl.textContent = `Вы проиграли. Выпало ${result.label}`;
        gameStatusEl.className = 'game-status error';
        sfxLose();
      }

      resultDisplay.textContent = result.label;
      resultDisplay.style.backgroundColor = result.color;
      resultDisplay.style.display = 'flex';
      addHistoryItem(result.num, result.color);

      setTimeout(() => {
        gameActive = false;
        playBtn.disabled = false;
        resultDisplay.style.display = 'none';
      }, 2000);
    });
  });

  document.querySelectorAll('.balance-value').forEach(el => {
    el.textContent = getBalance().toFixed(2);
  });

  drawWheel();
  document.addEventListener('click', () => initAudio(), { once: true });
});
