document.addEventListener('DOMContentLoaded', function(){
  const stakeInput = document.getElementById('stakeInput');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const playBtn = document.getElementById('playBtn');
  const cashoutBtn = document.getElementById('cashoutBtn');
  const continueBtn = document.getElementById('continueBtn');
  const stakePanel = document.getElementById('stakePanel');
  const gamePanel = document.getElementById('gamePanel');
  const resultPanel = document.getElementById('resultPanel');
  const crashChart = document.getElementById('crashChart');
  const crashMultiplier = document.getElementById('crashMultiplier');
  const resultMultiplier = document.getElementById('resultMultiplier');
  const gameStatus = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const gameStake = document.getElementById('gameStake');
  const gameWinning = document.getElementById('gameWinning');

  // Hide multiplier by default, show only during game
  crashMultiplier.style.display = 'none';
  
  let gameRunning = false;
  let gameHistory = [];
  let currentGameData = null;
  let gameLoopId = null;

  // Balance helpers
  function getBalance(){ 
    return parseFloat(localStorage.getItem('mc_balance') || '0') || 0; 
  }
  
  function setBalance(v){ 
    const n = Math.round(Number(v) * 100) / 100; 
    localStorage.setItem('mc_balance', n.toFixed(2)); 
    document.querySelectorAll('.balance-value').forEach(el=>el.textContent = n.toFixed(2)); 
  }

  // Quick bet buttons
  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      const currentValue = parseFloat(stakeInput.value) || 0;
      const newValue = currentValue + amount;
      stakeInput.value = Math.min(1000000, newValue).toFixed(2);
    });
  });

  halfBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.max(0.2, (val / 2).toFixed(2));
  });

  doubleBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.min(1000000, (val * 2).toFixed(2));
  });

  playBtn.addEventListener('click', () => {
    const stake = parseFloat(stakeInput.value);
    
    if(isNaN(stake) || stake <= 0){
      alert('Введите корректную ставку');
      return;
    }

    if(stake < 0.2){
      alert('Минимальная ставка 0.2');
      return;
    }

    if(getBalance() < stake){
      alert('Недостаточно средств');
      return;
    }

    startGame(stake);
  });

  cashoutBtn.addEventListener('click', () => {
    if(gameRunning && currentGameData) {
      endGame(true); // Win - cashout
    }
  });

  continueBtn.addEventListener('click', () => {
    resultPanel.style.display = 'none';
    stakePanel.style.display = 'flex';
    stakeInput.value = '1';
  });

  function startGame(stake) {
    gameRunning = true;
    playBtn.disabled = true;

    // Deduct stake
    setBalance(getBalance() - stake);

    // Crash probability: VERY often on low multipliers (high difficulty)
    // Most games crash quickly = hard to win
    const random = Math.random();
    let crashPoint;
    
    if(random < 0.65) {
      // 65% chance: 1.5x - 3.5x (VERY LOW - game almost always crashes here)
      crashPoint = 1.5 + Math.random() * 2;
    } else if(random < 0.85) {
      // 20% chance: 3.5x - 8x
      crashPoint = 3.5 + Math.random() * 4.5;
    } else if(random < 0.95) {
      // 10% chance: 8x - 25x
      crashPoint = 8 + Math.random() * 17;
    } else {
      // 5% chance: 25x - 100x (rare big wins)
      crashPoint = 25 + Math.random() * 75;
    }

    // Store game data
    currentGameData = {
      stake: stake,
      crashPoint: crashPoint,
      startTime: Date.now(),
      currentMultiplier: 1.00
    };

    // Show game panel
    stakePanel.style.display = 'none';
    gamePanel.style.display = 'flex';
    crashMultiplier.style.display = 'block';
    gameStake.textContent = '$' + stake.toFixed(2);
    gameWinning.textContent = '$0.00';
    crashMultiplier.textContent = '1.00x';

    // Set up canvas
    if(crashChart) {
      crashChart.width = crashChart.offsetWidth;
      crashChart.height = crashChart.offsetHeight;
    }

    // Game loop - МЕДЛЕННЕЕ (2000ms вместо 800ms)
    const startTime = Date.now();
    const duration = Math.max(2000, crashPoint * 1500); // Longer duration for slower curve

    gameLoopId = setInterval(() => {
      if(!gameRunning) {
        clearInterval(gameLoopId);
        return;
      }

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Slower exponential curve
      const multiplier = 1 + (Math.exp(progress * 1.8) - 1) * (crashPoint - 1);

      currentGameData.currentMultiplier = multiplier;
      crashMultiplier.textContent = multiplier.toFixed(2) + 'x';
      gameWinning.textContent = '$' + (stake * multiplier).toFixed(2);

      // Draw chart
      drawChart(multiplier, crashPoint);

      // Check for crash
      if(multiplier >= crashPoint) {
        clearInterval(gameLoopId);
        endGame(false); // crash = lose
      }
    }, 50);
  }

  function drawChart(currentMult, maxMult) {
    if(!crashChart) return;
    
    const ctx = crashChart.getContext('2d');
    const w = crashChart.width;
    const h = crashChart.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for(let i = 1; i < 5; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    for(let i = 0; i <= 5; i++) {
      const val = (maxMult * i / 5).toFixed(1);
      const y = h - (h / 5) * i;
      ctx.fillText(val + 'x', 5, y);
    }

    // Draw curve
    const points = [];
    const steps = 100;
    
    for(let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const mult = 1 + (Math.exp(progress * 2) - 1) * (maxMult - 1);
      
      if(mult <= currentMult) {
        const x = (progress * currentMult / maxMult) * w;
        const y = h - (mult / maxMult) * h * 0.85;
        points.push({ x, y });
      }
    }

    if(points.length > 1) {
      // Glow effect
      ctx.shadowColor = 'rgba(46, 227, 107, 0.6)';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = 'rgba(46, 227, 107, 0.3)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for(let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();

      // Main line
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(46, 227, 107, 1)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for(let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
  }

  function playCrashAnimation(callback) {
    // Add shake effect
    gamePanel.classList.add('shake');

    // Create red flash overlay
    const overlay = document.createElement('div');
    overlay.className = 'crash-overlay';
    document.body.appendChild(overlay);

    // Remove after animation
    setTimeout(() => {
      gamePanel.classList.remove('shake');
      overlay.remove();
      if(callback) callback();
    }, 800);
  }

  function endGame(won) {
    gameRunning = false;
    if(gameLoopId) clearInterval(gameLoopId);

    const multiplier = currentGameData.currentMultiplier;
    const crashPt = currentGameData.crashPoint;

    if(won) {
      // Cashout - show result immediately
      const winAmount = currentGameData.stake * multiplier;
      setBalance(getBalance() + winAmount);
      
      resultMultiplier.textContent = multiplier.toFixed(2) + 'x';
      gameStatus.textContent = `✓ ВЫИГРЫШ: $${winAmount.toFixed(2)}`;
      gameStatus.className = 'game-status success';
      
      addToHistory({ mult: multiplier, win: true });

      gamePanel.style.display = 'none';
      resultPanel.style.display = 'flex';
      playBtn.disabled = false;
    } else {
      // Crash - show animation first
      playCrashAnimation(() => {
        resultMultiplier.textContent = crashPt.toFixed(2) + 'x';
        gameStatus.textContent = `✗ КРАХ НА ${crashPt.toFixed(2)}x`;
        gameStatus.className = 'game-status error';
        
        addToHistory({ mult: crashPt, win: false });

        gamePanel.style.display = 'none';
        resultPanel.style.display = 'flex';
        playBtn.disabled = false;
      });
    }
  }

  function addToHistory(record) {
    gameHistory.unshift(record);
    if(gameHistory.length > 20) gameHistory.pop();
    updateHistoryDisplay();
  }

  function updateHistoryDisplay() {
    historyScroll.innerHTML = '';
    gameHistory.forEach(r => {
      const item = document.createElement('div');
      item.className = `history-item ${r.win ? 'win' : 'lose'}`;
      item.textContent = r.mult.toFixed(2) + 'x';
      historyScroll.appendChild(item);
    });
  }

  // Initialize balance display
  document.querySelectorAll('.balance-value').forEach(el => {
    el.textContent = getBalance().toFixed(2);
  });
});

