document.addEventListener('DOMContentLoaded', function() {
  const canvas = document.getElementById('dreamWheel');
  const betsPanel = document.getElementById('betsPanel');
  const playBtn = document.getElementById('playBtn');
  const resultPanel = document.getElementById('resultPanel');
  const resultEmoji = document.getElementById('resultEmoji');
  const resultBadge = document.getElementById('resultBadge');
  const resultNum = document.getElementById('resultNum');
  const resultStake = document.getElementById('resultStake');
  const resultWin = document.getElementById('resultWin');
  const continueBtn = document.getElementById('continueBtn');
  const historyScroll = document.getElementById('historyScroll');
  const historyCount = document.getElementById('historyCount');
  const dreamStake = document.getElementById('dreamStake');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const betBtns = document.querySelectorAll('.bet-btn');

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const SEGMENTS = [
    { num: 1, color: '#f3c025', label: '1', count: 23 },
    { num: 2, color: '#0072e5', label: '2', count: 15 },
    { num: 5, color: '#a65ecc', label: '5', count: 7 },
    { num: 10, color: '#096', label: '10', count: 4 },
    { num: 20, color: '#ff5722', label: '20', count: 2 },
    { num: 40, color: '#e5004c', label: '40', count: 1 },
    { num: '2x', color: '#e91e63', label: '2x', count: 1 },
    { num: '5x', color: '#9c27b0', label: '5x', count: 1 },
  ];

  const wheelData = [];
  SEGMENTS.forEach(seg => {
    for (let i = 0; i < seg.count; i++) {
      wheelData.push({ num: seg.num, color: seg.color, label: seg.label });
    }
  });

  const TOTAL_SEGMENTS = wheelData.length;
  const SEGMENT_ANGLE = 360 / TOTAL_SEGMENTS;

  // ============ STATE ============
  let gameState = 'idle';
  let selectedBet = 1;
  let currentStake = 1;
  let gameHistory = [];
  let rotation = 0;
  let soundEnabled = true;
  let audioCtx = null;

  // ============ AUDIO ============
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

  // ============ BALANCE ============
  function getBalance() { return parseFloat(localStorage.getItem('mc_balance') || '100') || 100; }

  function setBalance(v) {
    const n = Math.round(Number(v) * 100) / 100;
    localStorage.setItem('mc_balance', n.toFixed(2));
    document.querySelectorAll('.balance-value').forEach(el => el.textContent = n.toFixed(2));
  }

  // ============ CANVAS SETUP ============
  const size = 340;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = '280px';
  canvas.style.height = '280px';
  ctx.scale(dpr, dpr);

  // ============ WHEEL DRAWING ============
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
      ctx.fillStyle = wheelData[i].color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      const midAngle = (startAngle + endAngle) / 2;
      ctx.rotate(midAngle);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Inter, Arial, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.fillText(wheelData[i].label, radius * 0.70, 4);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  // ============ BET SELECTION ============
  betBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameState !== 'idle' && gameState !== 'betting') return;
      betBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedBet = parseInt(btn.dataset.bet);
      sfxTick();
    });
  });

  if (betBtns[0]) betBtns[0].classList.add('selected');

  // ============ STAKE HELPERS ============
  halfBtn.addEventListener('click', () => {
    const val = parseFloat(dreamStake.value) || 1;
    dreamStake.value = Math.max(0.5, (val / 2).toFixed(2));
  });

  doubleBtn.addEventListener('click', () => {
    const val = parseFloat(dreamStake.value) || 1;
    dreamStake.value = Math.min(200, (val * 2).toFixed(2));
  });

  // ============ PLAY GAME ============
  playBtn.addEventListener('click', () => {
    initAudio();
    if (gameState !== 'idle' && gameState !== 'betting') return;

    const stake = parseFloat(dreamStake.value);
    if (isNaN(stake) || stake < 0.5) {
      alert('Минимальная ставка $0.5');
      return;
    }
    if (getBalance() < stake) {
      alert('Недостаточно средств');
      return;
    }

    currentStake = stake;
    setBalance(getBalance() - stake);
    gameState = 'spinning';

    playBtn.disabled = true;
    betsPanel.style.opacity = '0.5';
    betsPanel.style.pointerEvents = 'none';

    // Weighted result (matches original probability distribution)
    const rand = Math.random();
    let resultIndex;
    if (rand < 0.30) resultIndex = Math.floor(Math.random() * 23);
    else if (rand < 0.58) resultIndex = 23 + Math.floor(Math.random() * 15);
    else if (rand < 0.78) resultIndex = 38 + Math.floor(Math.random() * 7);
    else if (rand < 0.88) resultIndex = 45 + Math.floor(Math.random() * 4);
    else if (rand < 0.94) resultIndex = 49 + Math.floor(Math.random() * 2);
    else if (rand < 0.97) resultIndex = 51;
    else if (rand < 0.985) resultIndex = 52;
    else resultIndex = 53;

    const resultData = wheelData[resultIndex];

    // Target rotation: bring result segment to top (under pointer)
    const segmentCenter = resultIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const targetAngle = (360 - segmentCenter) % 360;
    const totalRotation = 360 * 7 + targetAngle;
    const duration = 5000;
    const startRotation = rotation % 360;
    const startTime = Date.now();
    let lastSegmentPassed = -1;

    function animateSpin() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth deceleration (cubic ease out)
      const eased = 1 - Math.pow(1 - progress, 3);
      rotation = (startRotation + totalRotation * eased) % 360;

      drawWheel();

      // Tick sounds on segment crossings
      const currentSegment = Math.floor(((rotation % 360) + 360) % 360 / SEGMENT_ANGLE);
      if (currentSegment !== lastSegmentPassed && progress < 0.9) {
        lastSegmentPassed = currentSegment;
        sfxTick();
      }

      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        gameState = 'result';
        showResult(resultData);
      }
    }

    requestAnimationFrame(animateSpin);
  });

  // ============ SHOW RESULT ============
  function showResult(resultData) {
    const betValue = selectedBet;
    const isMultiplier = /^[0-9]+x$/i.test(String(resultData.num));
    const resultNumValue = isMultiplier ? parseInt(resultData.num) : resultData.num;
    const won = betValue === resultNumValue;

    let winAmount = 0;
    if (won) {
      const HOUSE_EDGE = 0.06;
      const payouts = { 1: 1.0, 2: 2.0, 5: 5.0, 10: 10.0, 20: 20.0, 40: 40.0, '2x': 40.0, '5x': 150.0 };
      winAmount = Math.round(currentStake * (payouts[betValue] || 0) * (1 - HOUSE_EDGE) * 100) / 100;
      setBalance(getBalance() + winAmount);
    }

    resultEmoji.textContent = won ? '🎉' : '💫';
    resultEmoji.style.animation = 'none';
    void resultEmoji.offsetHeight;
    resultEmoji.style.animation = 'bounceIn 0.5s cubic-bezier(.2,.9,.2,1)';

    resultNum.textContent = isMultiplier ? resultData.num : 'x' + resultData.num;
    resultBadge.className = 'result-badge ' + getResultClass(resultData.num);
    resultStake.textContent = '$' + currentStake.toFixed(2);
    resultWin.textContent = '$' + winAmount.toFixed(2);
    resultWin.className = 'result-detail-value ' + (won ? '' : 'loss');

    resultPanel.style.display = 'flex';
    betsPanel.style.display = 'none';

    won ? sfxWin() : sfxLose();

    addToHistory({
      num: resultData.num,
      color: resultData.color,
      won: won,
      winAmount: winAmount,
      stake: currentStake
    });
  }

  function getResultClass(num) {
    if (/^[0-9]+x$/i.test(String(num))) return 'mult';
    const map = { 1: 'num-1', 2: 'num-2', 5: 'num-5', 10: 'num-10', 20: 'num-20', 40: 'num-40' };
    return map[num] || '';
  }

  // ============ HISTORY ============
  function addToHistory(record) {
    gameHistory.unshift(record);
    if (gameHistory.length > 25) gameHistory.pop();
    updateHistoryDisplay();
  }

  function updateHistoryDisplay() {
    historyScroll.innerHTML = '';
    gameHistory.forEach(r => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.textContent = (/^[0-9]+x$/i.test(String(r.num))) ? r.num.toUpperCase() : 'x' + r.num;
      if (r.won) {
        item.style.background = 'rgba(46,227,107,0.1)';
        item.style.border = '1px solid rgba(46,227,107,0.2)';
        item.style.color = 'var(--accent-green)';
      } else {
        item.style.background = 'rgba(255,107,107,0.1)';
        item.style.border = '1px solid rgba(255,107,107,0.2)';
        item.style.color = '#ff6b6b';
      }
      historyScroll.appendChild(item);
    });
    historyCount.textContent = gameHistory.length;
  }

  // ============ CONTINUE ============
  continueBtn.addEventListener('click', () => {
    resultPanel.style.display = 'none';
    betsPanel.style.display = 'flex';
    betsPanel.style.opacity = '1';
    betsPanel.style.pointerEvents = 'auto';
    playBtn.disabled = false;
    gameState = 'betting';
    rotation = 0;
    drawWheel();
  });

  // ============ INIT ============
  setBalance(getBalance());
  gameState = 'betting';
  drawWheel();

  document.addEventListener('click', () => initAudio(), { once: true });
});
