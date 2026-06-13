document.addEventListener('DOMContentLoaded', function(){
  function recordStat(type, amount, detail){
    try{
      const uid = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: uid, type, amount: Math.abs(amount), detail: detail || 'Plinko'})
      }).catch(function(){});
    }catch(e){}
  }

  const canvas = document.getElementById('plinkoCanvas');
  const ctx = canvas.getContext('2d');
  const ballsContainer = document.getElementById('plinkoBalls');
  const slotsContainer = document.getElementById('plinkoSlots');
  const stakeInput = document.getElementById('stakeInput');
  const playBtn = document.getElementById('playBtn');
  const gameStatus = document.getElementById('gameStatus');
  const phList = document.getElementById('phList');

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  let risk = 'low';
  let rows = 16;
  let ballCount = 1;
  let playing = false;
  let history = [];
  let activeBalls = 0;
  let roundResults = [];

  // Multipliers — fewer loss slots, more win slots
  // Pattern: big wins on edges, small wins/losses in center
  const MULTS = {
    low: {
      8:   [2.8, 1.6, 1, 0.9, 0.8, 0.9, 1, 1.6, 2.8],
      10:  [3.5, 1.8, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.8, 3.5],
      12:  [4.2, 2.2, 1.4, 1, 0.8, 0.6, 0.6, 0.8, 1, 1.4, 2.2, 4.2],
      14:  [5.1, 2.8, 1.6, 1.1, 0.9, 0.7, 0.5, 0.7, 0.9, 1.1, 1.6, 2.8, 5.1],
      16:  [6.2, 3.2, 1.8, 1.2, 1, 0.8, 0.6, 0.5, 0.6, 0.8, 1, 1.2, 1.8, 3.2, 6.2]
    },
    medium: {
      8:   [4.5, 2, 1.2, 0.8, 0.7, 0.8, 1.2, 2, 4.5],
      10:  [6.2, 2.8, 1.5, 1, 0.8, 0.6, 0.8, 1, 1.5, 2.8, 6.2],
      12:  [8.4, 3.6, 2, 1.2, 0.9, 0.7, 0.5, 0.7, 0.9, 1.2, 2, 3.6, 8.4],
      14:  [11.2, 4.8, 2.4, 1.4, 1, 0.8, 0.6, 0.4, 0.6, 0.8, 1, 1.4, 2.4, 4.8, 11.2],
      16:  [14.8, 6.2, 3, 1.6, 1.2, 0.9, 0.7, 0.5, 0.5, 0.7, 0.9, 1.2, 1.6, 3, 6.2, 14.8]
    },
    high: {
      8:   [8, 3, 1.5, 0.8, 0.6, 0.8, 1.5, 3, 8],
      10:  [12, 4.5, 2, 1, 0.7, 0.5, 0.7, 1, 2, 4.5, 12],
      12:  [18, 6.5, 2.8, 1.3, 0.9, 0.6, 0.4, 0.6, 0.9, 1.3, 2.8, 6.5, 18],
      14:  [26, 9, 3.8, 1.6, 1.1, 0.8, 0.5, 0.3, 0.5, 0.8, 1.1, 1.6, 3.8, 9, 26],
      16:  [36, 12, 5, 2, 1.3, 0.9, 0.6, 0.4, 0.3, 0.4, 0.6, 0.9, 1.3, 2, 5, 12, 36]
    }
  };

  function getMults(){ return MULTS[risk][rows] || MULTS.medium[16]; }

  // Ball count buttons
  const ballCounts = [1, 3, 5, 10];

  // Pyramid pins layout
  let pinPositions = []; // [{x,y}] for each row

  function resizeCanvas(){
    const wrap = canvas.parentElement;
    if(!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    calcPinPositions();
    drawBoard();
  }

  function calcPinPositions(){
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const topY = 25;
    const bottomY = h - 25;
    const centerX = w / 2;
    const topWidth = w * 0.15;  // narrow at top
    const botWidth = w * 0.85;  // wide at bottom

    pinPositions = [];
    for(let r = 0; r < rows; r++){
      const t = r / (rows - 1); // 0 at top, 1 at bottom
      const y = topY + (bottomY - topY) * t;
      const rowWidth = topWidth + (botWidth - topWidth) * t;
      const pinsInRow = r + 2;
      const rowPins = [];
      const spacing = rowWidth / (pinsInRow + 1);
      const startX = centerX - rowWidth / 2;
      for(let p = 0; p < pinsInRow; p++){
        const x = startX + spacing * (p + 1);
        rowPins.push({x, y});
      }
      pinPositions.push(rowPins);
    }
  }

  function drawBoard(){
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    // Draw pins
    pinPositions.forEach(row => {
      row.forEach(pin => {
        ctx.fillStyle = 'rgba(139,92,246,0.15)';
        ctx.beginPath(); ctx.arc(pin.x, pin.y, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(pin.x, pin.y, 2, 0, Math.PI*2); ctx.fill();
      });
    });
  }

  function getSlotColor(m){
    if(m >= 50) return 'linear-gradient(180deg,#e879f9,#d946ef)';
    if(m >= 20) return 'linear-gradient(180deg,#c084fc,#a855f7)';
    if(m >= 10) return 'linear-gradient(180deg,#f472b6,#ec4899)';
    if(m >= 5) return 'linear-gradient(180deg,#fb923c,#f97316)';
    if(m >= 2) return 'linear-gradient(180deg,#facc15,#eab308)';
    if(m >= 1) return 'linear-gradient(180deg,#4ade80,#22c55e)';
    return 'linear-gradient(180deg,#374151,#1f2937)';
  }

  function updateSlots(){
    const mults = getMults();
    slotsContainer.innerHTML = '';
    mults.forEach(m => {
      const div = document.createElement('div');
      div.className = 'plinko-slot';
      div.textContent = m >= 100 ? Math.round(m)+'x' : m.toFixed(1)+'x';
      div.style.background = getSlotColor(m);
      slotsContainer.appendChild(div);
    });
  }

  // Weighted random — 83% center (loss/small), 17% edges (big win)
  function getRandomSlot(slotCount){
    const center = (slotCount - 1) / 2;
    const weights = [];
    for(let i = 0; i < slotCount; i++){
      const dist = Math.abs(i - center) / center;
      // Center = weight 1.0, edges = weight 0.2 → ~83% center total
      weights.push(1.0 - dist * 0.8);
    }
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    for(let i = 0; i < weights.length; i++){
      rand -= weights[i];
      if(rand <= 0) return i;
    }
    return Math.floor(slotCount / 2);
  }
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    for(let i = 0; i < weights.length; i++){
      rand -= weights[i];
      if(rand <= 0) return i;
    }
    return Math.floor(slotCount / 2);
  }

  function dropSingleBall(stake, mults, onBallDone){
    const slotCount = mults.length;
    const finalSlot = getRandomSlot(slotCount);
    const mult = mults[finalSlot];

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Calculate target X based on slot
    const padding = 20;
    const usableW = w - padding * 2;
    const lastRowPins = pinPositions[pinPositions.length - 1];
    const slotWidth = usableW / slotCount;
    const targetX = padding + slotWidth * finalSlot + slotWidth / 2;
    const targetY = h - 15;

    const ball = document.createElement('div');
    ball.className = 'plinko-ball';
    ball.style.background = 'radial-gradient(circle at 35% 35%,#ffd700,#ff8c00)';
    ball.style.boxShadow = '0 0 6px rgba(255,200,0,0.8)';
    ballsContainer.appendChild(ball);

    // Animate ball falling through pins
    let pinIndex = 0;
    const startX = w / 2;
    const startY = 5;
    const totalFrames = rows * 12;
    let frame = 0;

    function animate(){
      frame++;
      const progress = frame / totalFrames;

      // Which pin row we're near
      const currentRow = Math.min(Math.floor(progress * rows), rows - 1);
      const nextRow = Math.min(currentRow + 1, rows - 1);
      const rowProgress = (progress * rows) - currentRow;

      // Get current and next pin positions
      const currentPins = pinPositions[currentRow];
      const nextPins = pinPositions[nextRow];

      // Interpolate Y
      const currentY = currentPins[0].y;
      const nextY = nextPins[0].y;
      const y = currentY + (nextY - currentY) * rowProgress;

      // X — move toward target with some randomness
      const baseX = startX + (targetX - startX) * progress;
      // Add bounce effect
      const bounce = Math.sin(progress * rows * Math.PI * 0.8) * 6 * (1 - progress);
      const x = baseX + bounce * (Math.random() - 0.5);

      ball.style.left = (x - 5) + 'px';
      ball.style.top = (y - 5) + 'px';

      if(frame < totalFrames){
        requestAnimationFrame(animate);
      } else {
        // Final position
        ball.style.left = (targetX - 5) + 'px';
        ball.style.top = (targetY - 5) + 'px';

        if(mult >= 1){
          ball.style.background = 'radial-gradient(circle at 35% 35%,#4ade80,#22c55e)';
          ball.style.boxShadow = '0 0 8px rgba(46,227,107,0.9)';
        } else {
          ball.style.background = 'radial-gradient(circle at 35% 35%,#f87171,#ef4444)';
          ball.style.boxShadow = '0 0 8px rgba(244,67,54,0.9)';
        }
        setTimeout(() => {
          ball.style.transition = 'opacity 0.3s';
          ball.style.opacity = '0';
          setTimeout(() => ball.remove(), 300);
          // Add to history immediately when ball lands
          addHistory(mult >= 1, mult);
          onBallDone(mult);
        }, 400);
      }
    }
    animate();
  }

  function play(){
    if(playing) return;
    const stake = parseFloat(stakeInput.value);
    if(isNaN(stake) || stake < 0.01){
      gameStatus.textContent = 'Мин. ставка $0.01';
      gameStatus.className = 'game-status lose';
      return;
    }
    const totalCost = stake * ballCount;
    if(getBalance() < totalCost){
      gameStatus.textContent = 'Недостаточно средств';
      gameStatus.className = 'game-status lose';
      return;
    }

    playing = true;
    playBtn.disabled = true;
    gameStatus.textContent = `🎱 ${ballCount} шарик(ов)...`;
    gameStatus.className = 'game-status';

    setBalance(getBalance() - totalCost);
    recordStat('bet', totalCost, 'Plinko x'+ballCount);

    const mults = getMults();
    activeBalls = ballCount;
    roundResults = [];

    for(let i = 0; i < ballCount; i++){
      setTimeout(() => {
        dropSingleBall(stake, mults, (mult) => {
          roundResults.push(mult);
          activeBalls--;
          if(activeBalls === 0){
            finishRound(stake);
          }
        });
      }, i * 200); // stagger balls
    }
  }

  function finishRound(stake){
    let totalWin = 0;
    let wins = 0, losses = 0;

    roundResults.forEach(mult => {
      const winAmount = Math.round(stake * mult * 100) / 100;
      totalWin += winAmount;
      if(mult >= 1){
        wins++;
        if(mult > 1) recordStat('win', winAmount, 'Plinko '+mult.toFixed(1)+'x');
      } else {
        losses++;
        recordStat('loss', stake - winAmount, 'Plinko '+mult.toFixed(1)+'x');
      }
    });

    const profit = totalWin - (stake * ballCount);
    setBalance(getBalance() + totalWin);

    if(profit > 0){
      gameStatus.innerHTML = `<span style="font-size:20px;font-weight:900">🎉 +$${profit.toFixed(2)}</span><br><span style="font-size:12px">${wins} выигрыш / ${losses} проигрыш</span>`;
      gameStatus.className = 'game-status win';
    } else {
      gameStatus.innerHTML = `<span style="font-size:20px;font-weight:900">💀 -$${Math.abs(profit).toFixed(2)}</span><br><span style="font-size:12px">${wins} выигрыш / ${losses} проигрыш</span>`;
      gameStatus.className = 'game-status lose';
    }

    playing = false;
    playBtn.disabled = false;
  }

  function addHistory(won, mult){
    history.unshift({won, mult});
    if(history.length > 50) history.pop();
    renderHistory();
  }

  function renderHistory(){
    phList.innerHTML = '';
    history.forEach(h => {
      const item = document.createElement('div');
      item.className = 'ph-item ' + (h.won ? 'ph-win' : 'ph-lose');
      item.textContent = h.mult.toFixed(1)+'x';
      phList.appendChild(item);
    });
  }

  // Risk buttons
  document.getElementById('riskBtns').addEventListener('click', function(e){
    const btn = e.target.closest('.plk-btn');
    if(!btn) return;
    document.querySelectorAll('#riskBtns .plk-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    risk = btn.dataset.risk;
    updateSlots();
  });

  // Rows buttons
  document.getElementById('rowsBtns').addEventListener('click', function(e){
    const btn = e.target.closest('.plk-btn');
    if(!btn) return;
    document.querySelectorAll('#rowsBtns .plk-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    rows = parseInt(btn.dataset.rows);
    updateSlots();
    resizeCanvas();
  });

  // Ball count buttons
  document.getElementById('ballBtns').addEventListener('click', function(e){
    const btn = e.target.closest('.plk-btn');
    if(!btn) return;
    document.querySelectorAll('#ballBtns .plk-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ballCount = parseInt(btn.dataset.count);
  });

  // Stake buttons
  document.getElementById('halfBtn').addEventListener('click', function(){
    const v = parseFloat(stakeInput.value) || 1;
    stakeInput.value = Math.max(0.01, (v/2).toFixed(2));
  });
  document.getElementById('doubleBtn').addEventListener('click', function(){
    const v = parseFloat(stakeInput.value) || 1;
    stakeInput.value = (v*2).toFixed(2);
  });

  playBtn.addEventListener('click', play);
  window.addEventListener('resize', resizeCanvas);

  setTimeout(function(){
    resizeCanvas();
    updateSlots();
  }, 100);
});
