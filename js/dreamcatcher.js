document.addEventListener('DOMContentLoaded', function() {
  // === STATS HELPER ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId, type, amount: Math.abs(amount), detail: detail || 'DreamCatcher'})
      }).catch(function(){});
    }catch(e){}
  }
  
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

  // Create segments array with uniform distribution
  const wheelData = new Array(54).fill(null);
  SEGMENTS.forEach(seg => {
    const step = 54 / seg.count;
    for (let i = 0; i < seg.count; i++) {
      let slot = Math.round(i * step + step / 2) % 54;
      while (wheelData[slot] !== null) slot = (slot + 1) % 54;
      wheelData[slot] = { num: seg.num, color: seg.color, label: seg.label };
    }
  });

  const TOTAL_SEGMENTS = wheelData.length;
  const SEGMENT_ANGLE = 360 / TOTAL_SEGMENTS;

  let gameState = 'idle';
  let selectedBet = 1;
  let currentStake = 1;
  let gameHistory = [];
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
  function sfxMultiplier() { playTone(500, 'triangle', 0.15, 0.06); playTone(700, 'sine', 0.2, 0.05); }

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

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

  halfBtn.addEventListener('click', () => {
    const val = parseFloat(dreamStake.value) || 1;
    dreamStake.value = Math.max(0.1, (val / 2).toFixed(2));
  });

  doubleBtn.addEventListener('click', () => {
    const val = parseFloat(dreamStake.value) || 1;
    dreamStake.value = Math.min(200, (val * 2).toFixed(2));
  });

  function pickRandomSegmentIndex() {
    return Math.floor(Math.random() * TOTAL_SEGMENTS);
  }

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

  function getColorForResult(num) {
    if (typeof num === 'string' && num.includes('x')) {
      return 'linear-gradient(30deg, #f3c025, #e5004c)';
    }
    const map = {
      1: '#f3c025',
      2: '#0072e5',
      5: '#a65ecc',
      10: '#096',
      20: '#ff5722',
      40: '#e5004c'
    };
    return map[num] || '#666';
  }

  function addHistoryItem(num) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const numStr = String(num);
    const isMult = /^[0-9]+x$/i.test(numStr);
    const text = isMult ? num.toUpperCase() : 'x' + num;
    item.textContent = text;
    item.style.background = getColorForResult(num);
    item.style.color = (num === 1) ? '#000' : '#fff';
    item.style.border = 'none';
    historyScroll.insertBefore(item, historyScroll.firstChild);
  }

  playBtn.addEventListener('click', () => {
    initAudio();
    if (gameState !== 'idle' && gameState !== 'betting') return;

    const stake = parseFloat(dreamStake.value);
    if (isNaN(stake) || stake < 0.1) {
      alert('Минимальная ставка $0.1');
      return;
    }
    if (getBalance() < stake) {
      alert('Недостаточно средств');
      return;
    }

     currentStake = stake;
     setBalance(getBalance() - stake);
     recordStat('bet', stake, `DreamCatcher x${selectedBet}`);
     if(window.mcStats) mcStats.addBet(Math.abs(stake), 'DreamCatcher', `Ставка на x${selectedBet}`);
     gameState = 'spinning';

    playBtn.disabled = true;
    betsPanel.style.opacity = '0.5';
    betsPanel.style.pointerEvents = 'none';
    resultPanel.style.display = 'none';

    const firstIndex = pickRandomSegmentIndex();
    const firstResult = wheelData[firstIndex];

    spinToIndex(firstIndex, 4000, () => {
      const isMult = typeof firstResult.num === 'string' && firstResult.num.includes('x');

      if (isMult) {
        sfxMultiplier();
        addHistoryItem(firstResult.num);

        resultEmoji.textContent = '🎰';
        resultNum.textContent = firstResult.num.toUpperCase();
        resultBadge.className = 'result-badge mult';
        resultStake.textContent = '$' + currentStake.toFixed(2);
        resultWin.textContent = 'БОНУСНОЕ ВРАЩЕНИЕ!';
        resultWin.className = 'result-detail-value';
        continueBtn.style.display = 'none';
        resultPanel.style.display = 'flex';

        const multValue = parseInt(firstResult.num);

        setTimeout(() => {
          const secondIndex = pickRandomSegmentIndex();
          const secondResult = wheelData[secondIndex];
          const finalNum = secondResult.num * multValue;

          spinToIndex(secondIndex, 4000, () => {
            addHistoryItem(finalNum);
            showFinalResult(finalNum, firstResult.num);
          });
        }, 1200);

      } else {
        addHistoryItem(firstResult.num);
        showFinalResult(firstResult.num, null);
      }
    });
  });

  function showFinalResult(finalNum, bonusMultiplier) {
    const betValue = selectedBet;
    const won = betValue === finalNum;

    let winAmount = 0;
    if (won) {
      const HOUSE_EDGE = 0.06;
      const payouts = { 1: 2.0, 2: 3.0, 5: 5.0, 10: 10.0, 20: 20.0, 40: 40.0 };
       winAmount = Math.round(currentStake * (payouts[betValue] || 0) * (1 - HOUSE_EDGE) * 100) / 100;
       setBalance(getBalance() + winAmount);
       recordStat('win', winAmount, `DreamCatcher won x${finalNum}`);
       if(window.mcStats) mcStats.addWin(winAmount, 'DreamCatcher', `Выпало x${finalNum}`);
     } else {
       recordStat('loss', currentStake, `DreamCatcher lost x${finalNum}`);
       if(window.mcStats) mcStats.addLoss(currentStake, 'DreamCatcher', `Выпало x${finalNum}, ставка на x${betValue}`);
     }

    resultEmoji.textContent = won ? '🎉' : '💫';
    resultEmoji.style.animation = 'none';
    void resultEmoji.offsetHeight;
    resultEmoji.style.animation = 'bounceIn 0.5s cubic-bezier(.2,.9,.2,1)';

    resultNum.textContent = 'x' + finalNum;
    resultBadge.className = 'result-badge ' + getResultClassForNum(finalNum);
    resultStake.textContent = '$' + currentStake.toFixed(2);
    resultWin.textContent = '$' + winAmount.toFixed(2);
    resultWin.className = 'result-detail-value ' + (won ? '' : 'loss');

    if (bonusMultiplier) {
      resultNum.textContent = 'x' + finalNum + ' (' + bonusMultiplier.toUpperCase() + ')';
    }

    resultPanel.style.display = 'flex';
    betsPanel.style.display = 'none';

    won ? sfxWin() : sfxLose();
  }

  function getResultClassForNum(num) {
    const map = { 1: 'num-1', 2: 'num-2', 5: 'num-5', 10: 'num-10', 20: 'num-20', 40: 'num-40' };
    return map[num] || '';
  }

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

  setBalance(getBalance());
  gameState = 'betting';
  drawWheel();

  document.addEventListener('click', () => initAudio(), { once: true });
});
