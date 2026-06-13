document.addEventListener('DOMContentLoaded', function(){
  // === STATS ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId, type, amount: Math.abs(amount), detail: detail || 'Plinko'})
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
  let playing = false;
  let history = [];

  // Multipliers — small values in center (most probable), big on edges
  // Center slots are < 1 (loss), edges are big wins
  const MULTS = {
    low: {
      8:   [4.2, 1.8, 0.8, 0.3, 0.3, 0.8, 1.8, 4.2],
      10:  [6.1, 2.4, 1, 0.4, 0.2, 0.2, 0.4, 1, 2.4, 6.1],
      12:  [8.9, 3.2, 1.3, 0.5, 0.2, 0.1, 0.1, 0.2, 0.5, 1.3, 3.2, 8.9],
      14:  [12.4, 4.5, 1.8, 0.6, 0.2, 0.1, 0, 0.1, 0.2, 0.6, 1.8, 4.5, 12.4],
      16:  [16.8, 6.1, 2.4, 0.8, 0.3, 0.1, 0, 0, 0, 0.1, 0.3, 0.8, 2.4, 6.1, 16.8]
    },
    medium: {
      8:   [7.5, 2.4, 0.6, 0.2, 0.2, 0.6, 2.4, 7.5],
      10:  [12.4, 3.8, 0.9, 0.3, 0.1, 0.1, 0.3, 0.9, 3.8, 12.4],
      12:  [20.7, 6.1, 1.4, 0.4, 0.1, 0, 0, 0.1, 0.4, 1.4, 6.1, 20.7],
      14:  [34.2, 9.8, 2.1, 0.5, 0.1, 0, 0, 0, 0.1, 0.5, 2.1, 9.8, 34.2],
      16:  [54.6, 15.3, 3.2, 0.7, 0.1, 0, 0, 0, 0, 0.1, 0.7, 3.2, 15.3, 54.6]
    },
    high: {
      8:   [14.2, 3.6, 0.4, 0.1, 0.1, 0.4, 3.6, 14.2],
      10:  [28.5, 6.4, 0.7, 0.1, 0, 0, 0.1, 0.7, 6.4, 28.5],
      12:  [56.8, 12.4, 1.2, 0.2, 0, 0, 0, 0.2, 1.2, 12.4, 56.8],
      14:  [112, 23.6, 2.1, 0.3, 0, 0, 0, 0, 0.3, 2.1, 23.6, 112],
      16:  [220, 46.8, 4.2, 0.5, 0, 0, 0, 0, 0, 0.5, 4.2, 46.8, 220]
    }
  };

  function getMults(){ return MULTS[risk][rows] || MULTS.medium[16]; }

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

    // Pins
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
    if(m >= 100) return 'linear-gradient(180deg,#e879f9,#d946ef)';
    if(m >= 50) return 'linear-gradient(180deg,#c084fc,#a855f7)';
    if(m >= 20) return 'linear-gradient(180deg,#f472b6,#ec4899)';
    if(m >= 10) return 'linear-gradient(180deg,#f87171,#ef4444)';
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

  function dropBall(stake, onComplete){
    const mults = getMults();
    const slotCount = mults.length;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const pinStartY = 15;
    const pinEndY = h - 25;

    // Random slot — bell curve distribution (center is most probable)
    // This makes small multipliers (center) drop most often
    let pos = 0;
    for(let r = 0; r < rows; r++){
      // Bias toward center — smaller random range
      pos += (Math.random() - 0.5) * 0.5;
      // Pull back toward center each bounce (gravity effect)
      pos *= 0.85;
      pos = Math.max(-1, Math.min(1, pos));
    }
    // Add extra center bias
    if(Math.random() < 0.6) pos *= 0.7;
    const slotIndex = Math.floor((pos + 1) / 2 * (slotCount - 1));
    const finalSlot = Math.max(0, Math.min(slotCount - 1, slotIndex));
    const mult = mults[finalSlot];
    const finalX = (w / slotCount) * finalSlot + (w / slotCount) / 2;

    // Ball
    const ball = document.createElement('div');
    ball.className = 'plinko-ball';
    ball.style.background = 'radial-gradient(circle at 35% 35%,#ffd700,#ff8c00)';
    ball.style.boxShadow = '0 0 6px rgba(255,200,0,0.8)';
    ballsContainer.appendChild(ball);

    let frame = 0;
    const totalFrames = rows * 8;

    function animate(){
      frame++;
      const progress = frame / totalFrames;
      const y = pinStartY + (pinEndY - pinStartY) * progress;
      const x = (w/2) + (finalX - w/2) * progress + Math.sin(progress * rows * Math.PI) * 10 * (1 - progress);
      ball.style.left = (x - 4) + 'px';
      ball.style.top = (y - 4) + 'px';

      if(frame < totalFrames){
        requestAnimationFrame(animate);
      } else {
        ball.style.left = (finalX - 4) + 'px';
        ball.style.top = (h - 20) + 'px';
        if(mult >= 1){
          ball.style.background = 'radial-gradient(circle at 35% 35%,#4ade80,#22c55e)';
          ball.style.boxShadow = '0 0 8px rgba(46,227,107,0.9)';
        } else {
          ball.style.background = 'radial-gradient(circle at 35% 35%,#f87171,#ef4444)';
          ball.style.boxShadow = '0 0 8px rgba(244,67,54,0.9)';
        }
        setTimeout(() => {
          ball.style.transition = 'opacity 0.3s, transform 0.3s';
          ball.style.opacity = '0';
          ball.style.transform = 'scale(0.5)';
          setTimeout(() => ball.remove(), 300);
          onComplete(mult);
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
    if(getBalance() < stake){
      gameStatus.textContent = 'Недостаточно средств';
      gameStatus.className = 'game-status lose';
      return;
    }

    playing = true;
    playBtn.disabled = true;
    gameStatus.textContent = '';

    setBalance(getBalance() - stake);
    recordStat('bet', stake, 'Plinko');

    dropBall(stake, (mult) => {
      const winAmount = Math.round(stake * mult * 100) / 100;
      const profit = winAmount - stake;

      if(mult >= 1){
        setBalance(getBalance() + winAmount);
        if(mult > 1) recordStat('win', winAmount, 'Plinko '+mult.toFixed(1)+'x');
        gameStatus.innerHTML = `<span style="font-size:24px;font-weight:900">${mult.toFixed(1)}x</span><br>+$${profit > 0 ? profit.toFixed(2) : '0.00'}`;
        gameStatus.className = 'game-status win';
        addHistory(true, mult);
      } else {
        recordStat('loss', stake, 'Plinko');
        gameStatus.innerHTML = `<span style="font-size:24px;font-weight:900">${mult.toFixed(1)}x</span><br>-$${stake.toFixed(2)}`;
        gameStatus.className = 'game-status lose';
        addHistory(false, mult);
      }

      playing = false;
      playBtn.disabled = false;
    });
  }

  function addHistory(won, mult){
    history.unshift({won, mult});
    if(history.length > 20) history.pop();
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

  // Events
  document.getElementById('riskBtns').addEventListener('click', function(e){
    const btn = e.target.closest('.plk-btn');
    if(!btn) return;
    document.querySelectorAll('#riskBtns .plk-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    risk = btn.dataset.risk;
    updateSlots();
  });

  document.getElementById('rowsBtns').addEventListener('click', function(e){
    const btn = e.target.closest('.plk-btn');
    if(!btn) return;
    document.querySelectorAll('#rowsBtns .plk-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    rows = parseInt(btn.dataset.rows);
    updateSlots();
    resizeCanvas();
  });

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

  // Init
  setTimeout(function(){
    resizeCanvas();
    updateSlots();
  }, 100);
});
