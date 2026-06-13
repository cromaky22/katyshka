document.addEventListener('DOMContentLoaded', function(){
  // === STATS HELPER ===
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
  const multsContainer = document.getElementById('plinkoMults');
  const stakeInput = document.getElementById('stakeInput');
  const playBtn = document.getElementById('playBtn');
  const resultWrap = document.getElementById('resultWrap');
  const resultText = document.getElementById('resultText');
  const phList = document.getElementById('phList');

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  let risk = 'low';
  let rows = 15;
  let playing = false;
  let history = [];

  // Multiplier tables
  const MULTS = {
    low: {
      8:  [2.1, 1.4, 1.1, 1, 1, 1.1, 1.4, 2.1],
      9:  [2.8, 1.7, 1.2, 1.1, 1, 1.1, 1.2, 1.7, 2.8],
      10: [3.5, 2, 1.4, 1.1, 1, 1, 1.1, 1.4, 2, 3.5],
      11: [4.3, 2.4, 1.6, 1.2, 1.1, 1, 1.1, 1.2, 1.6, 2.4, 4.3],
      12: [5.2, 2.9, 1.9, 1.3, 1.1, 1, 1, 1.1, 1.3, 1.9, 2.9, 5.2],
      13: [6.3, 3.5, 2.2, 1.5, 1.2, 1.1, 1, 1.1, 1.2, 1.5, 2.2, 3.5, 6.3],
      14: [7.6, 4.2, 2.6, 1.7, 1.3, 1.1, 1, 1, 1.1, 1.3, 1.7, 2.6, 4.2, 7.6],
      15: [9.1, 5.1, 3.1, 2, 1.4, 1.2, 1.1, 1, 1.1, 1.2, 1.4, 2, 3.1, 5.1, 9.1],
      16: [10.9, 6.2, 3.7, 2.3, 1.6, 1.3, 1.1, 1, 1, 1.1, 1.3, 1.6, 2.3, 3.7, 6.2, 10.9]
    },
    medium: {
      8:  [3.2, 1.8, 1.3, 1, 1, 1.3, 1.8, 3.2],
      9:  [4.5, 2.3, 1.5, 1.1, 1, 1.1, 1.5, 2.3, 4.5],
      10: [6.1, 3, 1.8, 1.3, 1, 1, 1.3, 1.8, 3, 6.1],
      11: [8.2, 3.9, 2.3, 1.5, 1.1, 1, 1.1, 1.5, 2.3, 3.9, 8.2],
      12: [10.9, 5.1, 3, 1.9, 1.3, 1, 1, 1.3, 1.9, 3, 5.1, 10.9],
      13: [14.3, 6.7, 3.9, 2.4, 1.5, 1.1, 1, 1.1, 1.5, 2.4, 3.9, 6.7, 14.3],
      14: [18.6, 8.8, 5, 3, 1.9, 1.3, 1, 1, 1.3, 1.9, 3, 5, 8.8, 18.6],
      15: [24.2, 11.5, 6.5, 3.8, 2.3, 1.5, 1.1, 1, 1.1, 1.5, 2.3, 3.8, 6.5, 11.5, 24.2],
      16: [31.5, 14.9, 8.5, 4.9, 3, 1.9, 1.3, 1, 1, 1.3, 1.9, 3, 4.9, 8.5, 14.9, 31.5]
    },
    high: {
      8:  [5.6, 2.6, 1.5, 1, 1, 1.5, 2.6, 5.6],
      9:  [8.9, 3.8, 2, 1.2, 1, 1.2, 2, 3.8, 8.9],
      10: [14.8, 5.8, 2.9, 1.6, 1, 1, 1.6, 2.9, 5.8, 14.8],
      11: [24.7, 9, 4.5, 2.4, 1.3, 1, 1.3, 2.4, 4.5, 9, 24.7],
      12: [42.6, 14.2, 7, 3.7, 1.9, 1, 1, 1.9, 3.7, 7, 14.2, 42.6],
      13: [72, 23, 11, 5.8, 3, 1.4, 1, 1.4, 3, 5.8, 11, 23, 72],
      14: [120, 37, 17, 9, 4.6, 2.3, 1.3, 1, 1.3, 2.3, 4.6, 9, 17, 37, 120],
      15: [198, 60, 28, 14, 7.2, 3.7, 2, 1.3, 1, 1.3, 2, 3.7, 7.2, 14, 28, 60, 198],
      16: [340, 97, 45, 23, 12, 6, 3, 1.7, 1, 1, 1.7, 3, 6, 12, 23, 45, 97, 340]
    }
  };

  function getMults(){ return MULTS[risk][rows] || MULTS.low[15]; }

  function resizeCanvas(){
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = wrap.offsetWidth * dpr;
    canvas.height = wrap.offsetHeight * dpr;
    canvas.style.width = wrap.offsetWidth + 'px';
    canvas.style.height = wrap.offsetHeight + 'px';
    ctx.scale(dpr, dpr);
    drawBoard();
  }

  function drawBoard(){
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const mults = getMults();
    const slotCount = mults.length;
    const slotW = w / slotCount;
    const pinStartY = 30;
    const pinEndY = h - 40;
    const pinRows = rows;

    // Draw pins
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for(let r = 0; r < pinRows; r++){
      const y = pinStartY + (pinEndY - pinStartY) * (r / pinRows);
      const pinsInRow = r + 2;
      const pinSpacing = w / (pinsInRow + 1);
      for(let p = 0; p < pinsInRow; p++){
        const x = pinSpacing * (p + 1);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function updateSlots(){
    const mults = getMults();
    slotsContainer.innerHTML = '';
    mults.forEach(m => {
      const div = document.createElement('div');
      div.className = 'plinko-slot';
      div.textContent = m.toFixed(1) + 'x';
      div.style.background = getMultColor(m);
      slotsContainer.appendChild(div);
    });
  }

  function updateMults(){
    const mults = getMults();
    multsContainer.innerHTML = '';
    mults.forEach(m => {
      const div = document.createElement('div');
      div.className = 'plinko-mult-item ' + getMultClass(m);
      div.textContent = m.toFixed(1) + 'x';
      multsContainer.appendChild(div);
    });
  }

  function getMultColor(m){
    if(m >= 10) return 'rgba(156,39,176,0.5)';
    if(m >= 5) return 'rgba(244,67,54,0.4)';
    if(m >= 2) return 'rgba(255,184,107,0.4)';
    if(m >= 1) return 'rgba(46,227,107,0.35)';
    return 'rgba(255,184,107,0.2)';
  }

  function getMultClass(m){
    if(m >= 10) return 'mult-vhigh';
    if(m >= 5) return 'mult-high';
    if(m >= 2) return 'mult-med';
    return 'mult-low';
  }

  // Ball drop animation with physics
  function dropBall(stake, onComplete){
    const mults = getMults();
    const slotCount = mults.length;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const slotW = w / slotCount;
    const pinStartY = 30;
    const pinEndY = h - 40;

    // Determine slot based on random bounces
    let pos = 0; // -1 to 1 normalized
    for(let r = 0; r < rows; r++){
      pos += (Math.random() - 0.5) * 0.8;
      pos = Math.max(-1, Math.min(1, pos));
    }
    const slotIndex = Math.floor((pos + 1) / 2 * (slotCount - 1));
    const finalSlot = Math.max(0, Math.min(slotCount - 1, slotIndex));
    const mult = mults[finalSlot];

    // Animate ball
    const ball = document.createElement('div');
    ball.className = 'plinko-ball';
    ballsContainer.appendChild(ball);

    const ballSize = 10;
    const startX = w / 2 - ballSize / 2;
    const finalX = slotW * finalSlot + slotW / 2 - ballSize / 2;
    let frame = 0;
    const totalFrames = rows * 12;

    function animate(){
      frame++;
      const progress = frame / totalFrames;
      const y = pinStartY + (pinEndY - pinStartY) * progress + Math.sin(progress * 8) * 3;
      const x = startX + (finalX - startX) * progress + Math.sin(progress * rows * Math.PI) * 15 * (1 - progress);
      ball.style.left = x + 'px';
      ball.style.top = y + 'px';

      if(frame < totalFrames){
        requestAnimationFrame(animate);
      } else {
        ball.style.left = finalX + 'px';
        ball.style.top = (h - 35) + 'px';
        ball.style.background = getMultColor(mult);
        ball.style.boxShadow = `0 0 10px ${getMultColor(mult)}`;

        setTimeout(() => {
          ball.remove();
          onComplete(mult);
        }, 400);
      }
    }
    animate();
  }

  function play(){
    if(playing) return;
    const stake = parseFloat(stakeInput.value);
    if(isNaN(stake) || stake < 0.1){
      resultWrap.style.display = 'block';
      resultWrap.className = 'result-wrap result-lose';
      resultText.textContent = 'Мин. ставка $0.10';
      return;
    }
    if(stake > 200){
      resultWrap.style.display = 'block';
      resultWrap.className = 'result-wrap result-lose';
      resultText.textContent = 'Макс. ставка $200';
      return;
    }
    if(getBalance() < stake){
      resultWrap.style.display = 'block';
      resultWrap.className = 'result-wrap result-lose';
      resultText.textContent = 'Недостаточно средств';
      return;
    }

    playing = true;
    playBtn.disabled = true;
    resultWrap.style.display = 'none';

    setBalance(getBalance() - stake);
    recordStat('bet', stake, `Plinko ${risk} ${rows} rows`);

    dropBall(stake, (mult) => {
      const winAmount = Math.round(stake * mult * 100) / 100;
      const profit = winAmount - stake;

      if(mult > 1){
        setBalance(getBalance() + winAmount);
        recordStat('win', winAmount, `Plinko won ${mult.toFixed(1)}x`);
        resultWrap.className = 'result-wrap result-win';
        resultText.textContent = `🎉 Выигрыш! ${mult.toFixed(1)}x = $${winAmount.toFixed(2)} (+$${profit.toFixed(2)})`;
        addToHistory(true, mult);
      } else if(mult === 1){
        setBalance(getBalance() + winAmount); // Return stake
        resultWrap.className = 'result-wrap result-win';
        resultText.textContent = `😊 Возврат! $${winAmount.toFixed(2)}`;
        addToHistory(true, 1);
      } else {
        recordStat('loss', stake, `Plinko lost`);
        resultWrap.className = 'result-wrap result-lose';
        resultText.textContent = `💀 Проигрыш! -$${stake.toFixed(2)}`;
        addToHistory(false, mult);
      }

      resultWrap.style.display = 'block';
      playing = false;
      playBtn.disabled = false;
    });
  }

  function addToHistory(won, mult){
    history.unshift({ won, mult, time: Date.now() });
    if(history.length > 20) history.pop();
    renderHistory();
  }

  function renderHistory(){
    phList.innerHTML = '';
    history.forEach(h => {
      const item = document.createElement('div');
      item.className = 'ph-item ' + (h.won ? 'ph-win' : 'ph-lose');
      item.textContent = h.mult.toFixed(1) + 'x';
      phList.appendChild(item);
    });
  }

  // Risk buttons
  document.getElementById('riskBtns').addEventListener('click', function(e){
    const btn = e.target.closest('.plinko-btn');
    if(!btn) return;
    document.querySelectorAll('#riskBtns .plinko-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    risk = btn.dataset.risk;
    updateSlots();
    updateMults();
  });

  // Rows buttons
  document.getElementById('rowsBtns').addEventListener('click', function(e){
    const btn = e.target.closest('.plinko-btn');
    if(!btn) return;
    document.querySelectorAll('#rowsBtns .plinko-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    rows = parseInt(btn.dataset.rows);
    updateSlots();
    updateMults();
    resizeCanvas();
  });

  // Stake buttons
  document.getElementById('stakeHalf').addEventListener('click', function(){
    const v = parseFloat(stakeInput.value) || 1;
    stakeInput.value = Math.max(0.1, (v / 2).toFixed(2));
  });
  document.getElementById('stakeDouble').addEventListener('click', function(){
    const v = parseFloat(stakeInput.value) || 1;
    stakeInput.value = Math.min(200, (v * 2).toFixed(2));
  });

  // Play
  playBtn.addEventListener('click', play);

  // Init
  window.addEventListener('resize', resizeCanvas);
  setTimeout(() => {
    resizeCanvas();
    updateSlots();
    updateMults();
  }, 100);
});
