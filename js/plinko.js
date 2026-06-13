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

  // Multipliers — balanced, ~40% win chance
  const MULTS = {
    low: {
      8:   [3.5, 1.6, 0.8, 0.4, 0.4, 0.8, 1.6, 3.5],
      10:  [5.2, 2.1, 1, 0.5, 0.3, 0.3, 0.5, 1, 2.1, 5.2],
      12:  [7.8, 3.2, 1.3, 0.6, 0.3, 0.2, 0.2, 0.3, 0.6, 1.3, 3.2, 7.8],
      14:  [11.2, 4.5, 1.8, 0.7, 0.3, 0.1, 0.1, 0.1, 0.3, 0.7, 1.8, 4.5, 11.2],
      16:  [15.8, 6.2, 2.4, 0.9, 0.4, 0.1, 0, 0, 0.1, 0.4, 0.9, 2.4, 6.2, 15.8]
    },
    medium: {
      8:   [5.8, 2.2, 0.7, 0.3, 0.3, 0.7, 2.2, 5.8],
      10:  [9.5, 3.4, 1, 0.4, 0.2, 0.2, 0.4, 1, 3.4, 9.5],
      12:  [16.8, 5.6, 1.6, 0.5, 0.2, 0.1, 0.1, 0.2, 0.5, 1.6, 5.6, 16.8],
      14:  [29.4, 9.2, 2.6, 0.7, 0.2, 0.1, 0, 0.1, 0.2, 0.7, 2.6, 9.2, 29.4],
      16:  [50.2, 15.4, 4.2, 1, 0.3, 0.1, 0, 0, 0.1, 0.3, 1, 4.2, 15.4, 50.2]
    },
    high: {
      8:   [11.2, 3.4, 0.5, 0.2, 0.2, 0.5, 3.4, 11.2],
      10:  [22.5, 5.8, 0.8, 0.2, 0.1, 0.1, 0.2, 0.8, 5.8, 22.5],
      12:  [48.6, 12.4, 1.6, 0.3, 0.1, 0, 0, 0.1, 0.3, 1.6, 12.4, 48.6],
      14:  [102, 25.8, 3.2, 0.5, 0.1, 0, 0, 0, 0.1, 0.5, 3.2, 25.8, 102],
      16:  [216, 52.4, 6.8, 0.8, 0.1, 0, 0, 0, 0, 0.1, 0.8, 6.8, 52.4, 216]
    }
  };

  function getMults(){ return MULTS[risk][rows] || MULTS.medium[16]; }

  // Ball count buttons
  const ballCounts = [1, 3, 5, 10];

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
    drawBoard();
  }

  function drawBoard(){
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    const pinStartY = 15;
    const pinEndY = h - 25;
    for(let r = 0; r < rows; r++){
      const y = pinStartY + (pinEndY - pinStartY) * ((r + 0.5) / rows);
      const pinsInRow = r + 2;
      const spacing = w / (pinsInRow + 1);
      for(let p = 0; p < pinsInRow; p++){
        const x = spacing * (p + 1);
        ctx.fillStyle = 'rgba(139,92,246,0.12)';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI*2); ctx.fill();
      }
    }
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

  // Weighted random — bell curve, center more likely
  function getRandomSlot(slotCount){
    // Generate bell curve distribution
    let pos = 0;
    for(let r = 0; r < rows; r++){
      pos += (Math.random() - 0.5) * 0.6;
      pos *= 0.88; // pull toward center
      pos = Math.max(-1, Math.min(1, pos));
    }
    // 50% chance to add extra center bias
    if(Math.random() < 0.5) pos *= 0.6;
    const idx = Math.floor((pos + 1) / 2 * (slotCount - 1));
    return Math.max(0, Math.min(slotCount - 1, idx));
  }

  function dropSingleBall(stake, mults, onBallDone){
    const slotCount = mults.length;
    const finalSlot = getRandomSlot(slotCount);
    const mult = mults[finalSlot];

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const pinStartY = 15;
    const pinEndY = h - 25;
    const finalX = (w / slotCount) * finalSlot + (w / slotCount) / 2;

    const ball = document.createElement('div');
    ball.className = 'plinko-ball';
    ball.style.background = 'radial-gradient(circle at 35% 35%,#ffd700,#ff8c00)';
    ball.style.boxShadow = '0 0 6px rgba(255,200,0,0.8)';
    ballsContainer.appendChild(ball);

    let frame = 0;
    const totalFrames = rows * 6;

    function animate(){
      frame++;
      const progress = frame / totalFrames;
      const y = pinStartY + (pinEndY - pinStartY) * progress;
      const x = (w/2) + (finalX - w/2) * progress + Math.sin(progress * rows * Math.PI) * 8 * (1 - progress);
      ball.style.left = (x - 4) + 'px';
      ball.style.top = (y - 4) + 'px';

      if(frame < totalFrames){
        requestAnimationFrame(animate);
      } else {
        ball.style.left = (finalX - 4) + 'px';
        ball.style.top = (h - 18) + 'px';
        if(mult >= 1){
          ball.style.background = 'radial-gradient(circle at 35% 35%,#4ade80,#22c55e)';
          ball.style.boxShadow = '0 0 8px rgba(46,227,107,0.9)';
        } else {
          ball.style.background = 'radial-gradient(circle at 35% 35%,#f87171,#ef4444)';
          ball.style.boxShadow = '0 0 8px rgba(244,67,54,0.9)';
        }
        setTimeout(() => {
          ball.style.transition = 'opacity 0.2s';
          ball.style.opacity = '0';
          setTimeout(() => ball.remove(), 200);
          onBallDone(mult);
        }, 300);
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
      addHistory(mult >= 1, mult);
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
    if(history.length > 30) history.pop();
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
