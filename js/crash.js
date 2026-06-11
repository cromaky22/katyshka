document.addEventListener('DOMContentLoaded', function() {
  // ============ DOM ELEMENTS ============
  const stakeInput = document.getElementById('stakeInput');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const playBtn = document.getElementById('playBtn');
  const cashoutBtn = document.getElementById('cashoutBtn');
  const continueBtn = document.getElementById('continueBtn');
  const autoCashoutToggle = document.getElementById('autoCashoutToggle');
  const autoCashoutRow = document.getElementById('autoCashoutRow');
  const autoCashoutInput = document.getElementById('autoCashoutInput');
  const stakePanel = document.getElementById('stakePanel');
  const gamePanel = document.getElementById('gamePanel');
  const resultPanel = document.getElementById('resultPanel');
  const crashChart = document.getElementById('crashChart');
  const crashMultiplier = document.getElementById('crashMultiplier');
  const resultMultiplier = document.getElementById('resultMultiplier');
  const resultEmoji = document.getElementById('resultEmoji');
  const gameStatus = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const historyCount = document.getElementById('historyCount');
  const gameStake = document.getElementById('gameStake');
  const gameWinning = document.getElementById('gameWinning');
  const gameSpeed = document.getElementById('gameSpeed');
  const liveProfit = document.getElementById('liveProfit');
  const cashoutAmount = document.getElementById('cashoutAmount');
  const recentCrashes = document.getElementById('recentCrashes');
  const speedBtns = document.querySelectorAll('.speed-btn');

  // ============ STATE ============
  let gameRunning = false;
  let gameHistory = [];
  let currentGameData = null;
  let gameLoopId = null;
  let soundEnabled = true;
  let audioCtx = null;
  let speedMultiplier = 1;

  // ============ AUDIO ENGINE ============
  function initAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        soundEnabled = false;
      }
    }
  }

  function playTone(freq, type, duration, vol = 0.08) {
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

  function sfxTick() { playTone(800 + Math.random() * 400, 'sine', 0.05, 0.04); }
  function sfxCashout() { playTone(1200, 'square', 0.15, 0.06); playTone(1600, 'sine', 0.1, 0.05); }
  function sfxCrash() { playTone(80, 'sawtooth', 0.5, 0.07); playTone(60, 'square', 0.4, 0.05); }
  function sfxStart() { playTone(440, 'triangle', 0.1, 0.05); }

  // ============ BALANCE ============
  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  // ============ SPEED SELECTOR ============
  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      speedMultiplier = parseFloat(btn.dataset.speed);
      if (gameSpeed) gameSpeed.textContent = speedMultiplier + '×';
    });
  });

  // ============ AUTO CASHOUT TOGGLE ============
  autoCashoutToggle.addEventListener('click', () => {
    const isActive = autoCashoutToggle.classList.toggle('active');
    autoCashoutRow.style.display = isActive ? 'flex' : 'none';
  });

  // ============ QUICK BET & HELPERS ============
  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      const amount = parseFloat(btn.dataset.amount);
      const currentValue = parseFloat(stakeInput.value) || 0;
      const newValue = currentValue + amount;
      stakeInput.value = Math.min(1000000, newValue).toFixed(2);
    });
  });

  halfBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.max(0.1, (val / 2).toFixed(2));
  });

  doubleBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.min(1000000, (val * 2).toFixed(2));
  });

  // ============ PLAY BUTTON ============
  playBtn.addEventListener('click', () => {
    initAudio();
    const stake = parseFloat(stakeInput.value);

    if (isNaN(stake) || stake <= 0) {
      alert('Введите корректную ставку');
      return;
    }
    if (stake < 0.1) {
      alert('Минимальная ставка $0.1');
      return;
    }
    if (getBalance() < stake) {
      alert('Недостаточно средств');
      return;
    }
    startGame(stake);
  });

  // ============ CASHOUT ============
  cashoutBtn.addEventListener('click', () => {
    if (gameRunning && currentGameData) {
      cashOut();
    }
  });

  function cashOut() {
    if (!gameRunning || !currentGameData || currentGameData.cashedOut) return;
    currentGameData.cashedOut = true;
    currentGameData.cashedOutAt = currentGameData.currentMultiplier;
    const multiplier = currentGameData.cashedOutAt;
     const winAmount = currentGameData.stake * multiplier;
     setBalance(getBalance() + winAmount);
     if(window.mcStats) mcStats.addWin(winAmount, 'Crash', `Кэш-аут x${multiplier.toFixed(2)}`);

    sfxCashout();
    spawnParticles(window.innerWidth / 2, window.innerHeight / 3, 25);

    cashoutBtn.classList.add('cashed');
    cashoutBtn.innerHTML = '✓ ЗАБРАНО $' + winAmount.toFixed(2);
    liveProfit.classList.add('visible');
    liveProfit.textContent = '+$' + winAmount.toFixed(2);
  }

  // ============ CONTINUE ============
  continueBtn.addEventListener('click', () => {
    resultPanel.style.display = 'none';
    stakePanel.style.display = 'flex';
    playBtn.disabled = false;
    playBtn.textContent = '🚀 ПОЛЕТЕЛИ';
    stakeInput.value = '1';
    liveProfit.classList.remove('visible');
    liveProfit.textContent = '';
  });

  // ============ PROVABLY FAIR CRASH POINT ============
  // 🎰 CASINO-FAVORING: reduced big multiplier chances, more frequent early crashes
  // House edge raised to ~6-8% (industry competitive)
  function getCrashPoint() {
    const random = Math.random();

    // 6% instant crash at 1.00 (was 1%)
    if (random < 0.06) return Math.round((1.00 + Math.random() * 0.02) * 100) / 100;

    // 30% chance: 1.01 - 1.10x (very low, quick crash)
    if (random < 0.36) {
      return Math.round((1.01 + Math.random() * 0.09) * 100) / 100;
    }

    // 25% chance: 1.10 - 1.50x
    if (random < 0.61) {
      return Math.round((1.10 + Math.random() * 0.40) * 100) / 100;
    }

    // 20% chance: 1.50 - 2.50x
    if (random < 0.81) {
      return Math.round((1.50 + Math.random() * 1.00) * 100) / 100;
    }

    // 12% chance: 2.50 - 5.00x
    if (random < 0.93) {
      return Math.round((2.50 + Math.random() * 2.50) * 100) / 100;
    }

    // 5% chance: 5.00 - 15x
    if (random < 0.98) {
      return Math.round((5.00 + Math.random() * 10.00) * 100) / 100;
    }

    // 2% chance: 15x - 50x
    if (random < 1.00) {
      return Math.round((15.00 + Math.random() * 35.00) * 100) / 100;
    }

    // Fallback (rare)
    return 1.01;
  }

  // ============ START GAME ============
  function startGame(stake) {
    gameRunning = true;
    currentGameData = {
      stake: stake,
      crashPoint: getCrashPoint(),
      startTime: Date.now(),
      currentMultiplier: 1.00,
      currentProfit: 0,
      cashedOut: false,
      autoCashoutAt: null,
      lastTick: 0,
      tickAccum: 0,
    };

    // Get auto cashout target
    if (autoCashoutToggle.classList.contains('active') && autoCashoutInput.value) {
      const autoTarget = parseFloat(autoCashoutInput.value);
      if (autoTarget > 1) {
        currentGameData.autoCashoutAt = autoTarget;
      }
    }

     // Deduct stake
     setBalance(getBalance() - stake);
     if(window.mcStats) mcStats.addBet(Math.abs(stake), 'Crash', 'Ставка размещена');

    // UI transition
    sfxStart();
    stakePanel.style.display = 'none';
    gamePanel.style.display = 'flex';
    gamePanel.classList.add('loading');
    crashMultiplier.style.display = 'block';
    crashMultiplier.textContent = '1.00×';
    crashMultiplier.className = 'crash-multiplier';
    gameStake.textContent = '$' + stake.toFixed(2);
    gameWinning.textContent = '$0.00';
    liveProfit.textContent = '';
    liveProfit.classList.remove('visible');
    cashoutBtn.classList.remove('cashed');
    cashoutBtn.style.display = 'flex';
    cashoutBtn.innerHTML = '<span class="cashout-icon">💰</span> ЗАБРАТЬ';
    cashoutAmount.textContent = '$0.00';
    if (gameSpeed) gameSpeed.textContent = speedMultiplier + '×';

    // Canvas setup
    if (crashChart) {
      crashChart.width = crashChart.offsetWidth * (window.devicePixelRatio || 1);
      crashChart.height = crashChart.offsetHeight * (window.devicePixelRatio || 1);
    }

    // Game loop with SMOother tick-based updates
    const TICK_MS = 40; // 25 ticks per second = smooth
    const startTime = Date.now();

    function gameLoop() {
      if (!gameRunning) {
        clearInterval(gameLoopId);
        return;
      }

      const now = Date.now();
      const elapsed = now - startTime;
      
      // Base duration calculation: crashPoint * 800ms for normal speed
      const baseDuration = Math.max(3000, currentGameData.crashPoint * 2000);
      const duration = baseDuration / speedMultiplier;

      // Pre-calculate target multiplier at current progress
      const rawProgress = Math.min(elapsed / duration, 1);
      
      // Accelerating curve: starts slow, speeds up exponentially
      // Using a custom easing that feels like real crash games
      const easedProgress = rawProgress < 0.3 
        ? rawProgress * rawProgress * 3 
        : 0.27 + (rawProgress - 0.3) * 1.1;
      
      const clampedProgress = Math.min(easedProgress, 1);
      const multiplier = 1 + (Math.exp(clampedProgress * 2.5) - 1) * (currentGameData.crashPoint - 1);
      
      currentGameData.currentMultiplier = multiplier;
      currentGameData.currentProfit = stake * multiplier - stake;

      // UI
      crashMultiplier.textContent = multiplier.toFixed(2) + '×';
      gameWinning.textContent = '$' + (stake * multiplier).toFixed(2);
      cashoutAmount.textContent = '$' + (stake * multiplier).toFixed(2);
      liveProfit.textContent = '+' + (multiplier - 1).toFixed(2) + '×';
      liveProfit.classList.add('visible');

      // Color changes based on multiplier
      if (multiplier >= 2) {
        crashMultiplier.style.color = '#ffb94a';
        crashMultiplier.style.textShadow = '0 0 30px rgba(255, 185, 74, 0.6)';
      }
      if (multiplier >= 5) {
        crashMultiplier.style.color = '#ff7b7b';
        crashMultiplier.style.textShadow = '0 0 35px rgba(255, 123, 123, 0.6)';
      }
      if (multiplier >= 10) {
        crashMultiplier.style.color = '#ff4d4d';
        crashMultiplier.style.textShadow = '0 0 40px rgba(255, 77, 77, 0.7), 0 0 80px rgba(255, 77, 77, 0.3)';
      }

      // Draw chart
      drawChart(multiplier, currentGameData.crashPoint, elapsed, duration);

      // Tick sound
      if (multiplier >= 1.5 && multiplier < currentGameData.crashPoint - 0.1) {
        const newTick = Math.floor(multiplier * 2);
        if (newTick > currentGameData.lastTick) {
          currentGameData.lastTick = newTick;
          currentGameData.tickAccum++;
          if (currentGameData.tickAccum % 2 === 0) {
            sfxTick();
          }
        }
      }

      // Auto cashout check
      if (currentGameData.autoCashoutAt && multiplier >= currentGameData.autoCashoutAt && !currentGameData.cashedOut) {
        cashOut();
      }

      // Crash check
      if (multiplier >= currentGameData.crashPoint) {
        clearInterval(gameLoopId);
        endGame(currentGameData.cashedOut);
      }
    }

    gameLoopId = setInterval(gameLoop, TICK_MS);
  }

  // ============ END GAME ============
  function endGame(won) {
    gameRunning = false;
    if (gameLoopId) clearInterval(gameLoopId);

    const multiplier = currentGameData.cashedOutAt || currentGameData.currentMultiplier;
    const crashPt = currentGameData.crashPoint;

    gamePanel.classList.remove('loading');
    crashMultiplier.className = 'crash-multiplier';
    crashMultiplier.style.color = '';
    crashMultiplier.style.textShadow = '';

    if (won && currentGameData.cashedOut) {
      const winAmount = currentGameData.stake * multiplier;
      resultEmoji.textContent = '🎉';
      resultEmoji.style.animation = 'none';
      void resultEmoji.offsetHeight;
      resultEmoji.style.animation = 'victoryBounce 0.6s cubic-bezier(.2,.9,.2,1)';
      resultMultiplier.textContent = multiplier.toFixed(2) + '×';
      resultMultiplier.className = 'result-multiplier won';
      gameStatus.textContent = '✓ ВЫИГРЫШ: $' + winAmount.toFixed(2);
      gameStatus.className = 'game-status success';
      addToHistory({ mult: crashPt, won: true });
      spawnParticles(window.innerWidth / 2, window.innerHeight / 3, 40);
    } else {
      // CRASH
      sfxCrash();
      resultEmoji.textContent = '💥';
      resultMultiplier.textContent = crashPt.toFixed(2) + '×';
      resultMultiplier.className = 'result-multiplier crashed';
       gameStatus.textContent = '✗ КРАШ НА ' + crashPt.toFixed(2) + '×';
       gameStatus.className = 'game-status error';
       if(window.mcStats) mcStats.addLoss(currentGameData.stake, 'Crash', `Краш на x${crashPt.toFixed(2)}`);
      addToHistory({ mult: crashPt, won: false });

      // Flash + shake
      gamePanel.classList.add('shake');
      const flash = document.createElement('div');
      flash.className = 'crash-flash';
      flash.style.cssText = 'position:fixed;inset:0;z-index:999;pointer-events:none;';
      document.body.appendChild(flash);
      setTimeout(() => {
        gamePanel.classList.remove('shake');
        flash.remove();
      }, 700);
    }

    gamePanel.style.display = 'none';
    resultPanel.style.display = 'flex';
    playBtn.disabled = false;
    playBtn.textContent = '🚀 ПОЛЕТЕЛИ';
  }

  // ============ PARTICLES ============
  function spawnParticles(x, y, count) {
    const container = document.createElement('div');
    container.className = 'particles-container';
    const emojis = ['💎', '⭐', '✨', '💰', '🏆', '💫'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 180;
      p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--ty', Math.sin(angle) * dist + 30 + 'px');
      p.style.animationDuration = (0.5 + Math.random() * 0.6) + 's';
      container.appendChild(p);
    }
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 1500);
  }

  // ============ CHART ============
  function drawChart(currentMult, maxMult, elapsed, duration) {
    if (!crashChart) return;
    const ctx = crashChart.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = crashChart.width;
    const h = crashChart.height;

    ctx.clearRect(0, 0, w, h);

    // Grid lines (faint)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = dpr;
    for (let i = 1; i < 6; i++) {
      const y = (h / 6) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = `${10 * dpr}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'left';
    const maxY = Math.min(maxMult * 1.2, Math.max(currentMult * 1.3, 5));
    for (let i = 0; i <= 5; i++) {
      const val = (maxY * i / 5);
      const y = h - (h / 5) * i;
      ctx.fillText(val.toFixed(1) + '×', 6 * dpr, y - 2 * dpr);
    }

    // Build curve points
    const points = [];
    const steps = 120;
    const visibleProgress = Math.min(elapsed / duration, 1);
    
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const ep = p < 0.3 ? p * p * 3 : 0.27 + (p - 0.3) * 1.1;
      const cp = Math.min(ep, 1);
      const mult = 1 + (Math.exp(cp * 2.5) - 1) * (currentMult - 1);
      
      if (mult <= currentMult && p <= visibleProgress + 0.01) {
        const x = (p / Math.max(visibleProgress, 0.05)) * w;
        const y = h - ((mult - 1) / Math.max(maxY - 1, 0.5)) * h * 0.88;
        points.push({ x: Math.min(x, w), y: Math.max(Math.min(y, h), 0) });
      }
    }

    if (points.length > 1) {
      // Gradient for line
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(46, 227, 107, 0.9)');
      grad.addColorStop(1, 'rgba(46, 227, 107, 0.3)');

      // Fill area under curve
      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, 'rgba(46, 227, 107, 0.08)');
      fillGrad.addColorStop(1, 'rgba(46, 227, 107, 0)');
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, h);
      ctx.lineTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, h);
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Main line glow
      ctx.shadowColor = 'rgba(46, 227, 107, 0.4)';
      ctx.shadowBlur = 12 * dpr;
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3 * dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Bright leading dot at curve end
      if (points.length > 0) {
        const last = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(46, 227, 107, 0.8)';
        ctx.shadowBlur = 16 * dpr;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // ============ HISTORY ============
  function addToHistory(record) {
    gameHistory.unshift(record);
    if (gameHistory.length > 30) gameHistory.pop();
    updateHistoryDisplay();
    updateRecentCrashes(record);
  }

  function updateHistoryDisplay() {
    historyScroll.innerHTML = '';
    gameHistory.forEach(r => {
      const item = document.createElement('div');
      item.className = `history-item ${r.won ? 'win' : 'lose'}`;
      item.textContent = r.mult.toFixed(2) + '×';
      historyScroll.appendChild(item);
    });
    historyCount.textContent = gameHistory.length;
  }

  function updateRecentCrashes(record) {
    if (!recentCrashes) return;
    // Keep label + last 15 items
    const label = recentCrashes.querySelector('.recent-label');
    const items = recentCrashes.querySelectorAll('.recent-item');
    
    // Remove excess
    while (items.length >= 15) {
      recentCrashes.removeChild(items[recentCrashes.lastElementChild]);
    }

    const div = document.createElement('span');
    div.className = `recent-item ${record.won ? 'win' : 'lose'}`;
    div.textContent = record.mult.toFixed(2) + '×';
    
    if (label && label.nextSibling) {
      recentCrashes.insertBefore(div, label.nextSibling);
    } else {
      recentCrashes.appendChild(div);
    }
  }

  // ============ INIT ============
  document.querySelectorAll('.balance-value').forEach(el => {
    el.textContent = getBalance().toFixed(2);
  });

  // Sound on first click anywhere
  document.addEventListener('click', () => initAudio(), { once: true });
});
