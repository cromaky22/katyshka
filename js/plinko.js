document.addEventListener('DOMContentLoaded', function(){
  // === STATS HELPER ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      const data = {userId, type, amount: Math.abs(amount), detail: detail || 'Plinko'};
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
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
  let rows = 16;
  let playing = false;
  let history = [];

  // Multiplier tables — house edge ~3-8%, center slots are losses (< 1)
  const MULTS = {
    low: {
      8:  [5.6, 2.1, 1.1, 0.6, 0.6, 1.1, 2.1, 5.6],
      10: [8.9, 3, 1.3, 0.8, 0.5, 0.5, 0.8, 1.3, 3, 8.9],
      12: [13.8, 4.5, 1.8, 0.9, 0.4, 0.3, 0.4, 0.9, 1.8, 4.5, 13.8],
      14: [20.3, 6.7, 2.4, 1, 0.5, 0.2, 0.2, 0.5, 1, 2.4, 6.7, 20.3],
      16: [29.5, 9.1, 3.2, 1.2, 0.5, 0.2, 0.1, 0.1, 0.2, 0.5, 1.2, 3.2, 9.1, 29.5]
    },
    medium: {
      8:  [9.8, 2.8, 1.2, 0.4, 0.4, 1.2, 2.8, 9.8],
      10: [19.6, 4.8, 1.5, 0.5, 0.2, 0.2, 0.5, 1.5, 4.8, 19.6],
      12: [38.2, 8.2, 2.2, 0.6, 0.2, 0.1, 0.1, 0.2, 0.6, 2.2, 8.2, 38.2],
      14: [72.6, 14.8, 3.8, 0.8, 0.2, 0.1, 0.1, 0.1, 0.2, 0.8, 3.8, 14.8, 72.6],
      16: [138, 27.6, 6.5, 1.2, 0.3, 0.1, 0, 0, 0.1, 0.3, 1.2, 6.5, 27.6, 138]
    },
    high: {
      8:  [17.8, 4.2, 1.4, 0.2, 0.2, 1.4, 4.2, 17.8],
      10: [52.1, 10.4, 2, 0.3, 0.1, 0.1, 0.3, 2, 10.4, 52.1],
      12: [156, 26, 4.4, 0.5, 0.1, 0, 0, 0.1, 0.5, 4.4, 26, 156],
      14: [468, 70.2, 11, 0.9, 0.1, 0, 0, 0, 0.1, 0.9, 11, 70.2, 468],
      16: [1404, 210, 32, 2.7, 0.1, 0, 0, 0, 0, 0, 0.1, 2.7, 32, 210, 1404]
    }
  };

  function getMults(){ return MULTS[risk][rows] || MULTS.medium[16]; }

  function resizeCanvas(){
    const wrap = canvas.parentElement;
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
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const mults = getMults();
    const slotCount = mults.length;
    const pinStartY = 20;
    const pinEndY = h - 30;
    const pinRows = rows;

    // Draw pins with glow
    for(let r = 0; r < pinRows; r++){
      const y = pinStartY + (pinEndY - pinStartY) * ((r + 0.5) / pinRows);
      const pinsInRow = r + 2;
      const pinSpacing = w / (pinsInRow + 1);
      for(let p = 0; p < pinsInRow; p++){
        const x = pinSpacing * (p + 1);
        // Glow
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 6);
        grad.addColorStop(0, 'rgba(139,92,246,0.15)');
        grad.addColorStop(1, 'rgba(139,92,246,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        // Pin
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
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
    return 'linear-gradient(180deg,#374151,#1f2937)'; // loss - dark gray
  }

  function getColor(m){
    if(m >= 100) return {bg:'#d946ef',glow:'rgba(217,70,239,0.6)'};
    if(m >= 50) return {bg:'#a855f7',glow:'rgba(168,85,247,0.6)'};
    if(m >= 20) return {bg:'#ec4899',glow:'rgba(236,72,153,0.6)'};
    if(m >= 10) return {bg:'#ef4444',glow:'rgba(239,68,68,0.6)'};
    if(m >= 5) return {bg:'#f97316',glow:'rgba(249,115,22,0.6)'};
    if(m >= 2) return {bg:'#eab308',glow:'rgba(234,179,8,0.6)'};
    if(m >= 1) return {bg:'#22c55e',glow:'rgba(34,197,94,0.6)'};
    return {bg:'#1f2937',glow:'rgba(31,41,55,0.4)'}; // loss
  }

  function getMultColor(m){
    if(m >= 50) return 'mult-vhigh';
    if(m >= 10) return 'mult-high';
    if(m >= 5) return 'mult-high';
    if(m >= 2) return 'mult-med';
    return 'mult-low';
  }

  function updateSlots(){
    const mults = getMults();
    slotsContainer.innerHTML = '';
    mults.forEach(m => {
      const div = document.createElement('div');
      div.className = 'plinko-slot';
      div.textContent = m >= 100 ? Math.round(m) + 'x' : m.toFixed(1) + 'x';
      div.style.background = getSlotColor(m);
      slotsContainer.appendChild(div);
    });
  }

  function updateMults(){
    // No separate mults display — slots are shown in plinkoSlots
  }

  function dropBall(stake, onComplete){
    const mults = getMults();
    const slotCount = mults.length;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const pinStartY = 20;
    const pinEndY = h - 30;

    // Determine slot
    let pos = 0;
    for(let r = 0; r < rows; r++){
      pos += (Math.random() - 0.5) * 0.7;
      pos = Math.max(-1, Math.min(1, pos));
    }
    const slotIndex = Math.floor((pos + 1) / 2 * (slotCount - 1));
    const finalSlot = Math.max(0, Math.min(slotCount - 1, slotIndex));
    const mult = mults[finalSlot];

    const finalX = (w / slotCount) * finalSlot + (w / slotCount) / 2;

    // Create ball with glow
    const ball = document.createElement('div');
    ball.className = 'plinko-ball';
    ball.style.background = 'radial-gradient(circle at 35% 35%,#ffd700,#ff8c00)';
    ball.style.boxShadow = '0 0 8px rgba(255,200,0,0.8), 0 0 20px rgba(255,140,0,0.4)';
    ballsContainer.appendChild(ball);

    let frame = 0;
    const totalFrames = rows * 10;

    function animate(){
      frame++;
      const progress = frame / totalFrames;
      const y = pinStartY + (pinEndY - pinStartY) * progress + Math.sin(progress * 6) * 2;
      const x = (w / 2) + (finalX - w / 2) * progress + Math.sin(progress * rows * Math.PI) * 12 * (1 - progress);
      ball.style.left = (x - 6) + 'px';
      ball.style.top = (y - 6) + 'px';

      if(frame < totalFrames){
        requestAnimationFrame(animate);
      } else {
        ball.style.left = (finalX - 6) + 'px';
        ball.style.top = (h - 25) + 'px';
        // Change color based on result
        if(mult >= 2){
          ball.style.background = 'radial-gradient(circle at 35% 35%,#4ade80,#22c55e)';
          ball.style.boxShadow = '0 0 12px rgba(46,227,107,0.9), 0 0 30px rgba(46,227,107,0.5)';
        } else {
          ball.style.background = 'radial-gradient(circle at 35% 35%,#f87171,#ef4444)';
          ball.style.boxShadow = '0 0 12px rgba(244,67,54,0.9), 0 0 30px rgba(244,67,54,0.5)';
        }
        setTimeout(() => {
          ball.style.transition = 'all 0.3s';
          ball.style.opacity = '0';
          ball.style.transform = 'scale(0.5)';
          setTimeout(() => ball.remove(), 300);
          onComplete(mult);
        }, 500);
      }
    }
    animate();
  }

  function play(){
    if(playing) return;
    const stake = parseFloat(stakeInput.value);
    if(isNaN(stake) || stake < 0.01){
      resultWrap.style.display = 'block';
      resultWrap.className = 'result-wrap result-lose';
      resultText.textContent = 'Мин. ставка $0.01';
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
    playBtn.style.opacity = '0.6';
    resultWrap.style.display = 'none';

    setBalance(getBalance() - stake);
    recordStat('bet', stake, `Plinko ${risk} ${rows}`);

    dropBall(stake, (mult) => {
      const winAmount = Math.round(stake * mult * 100) / 100;
      const profit = winAmount - stake;

      if(mult >= 1){
        setBalance(getBalance() + winAmount);
        if(mult > 1) recordStat('win', winAmount, `Plinko ${mult.toFixed(1)}x`);
        resultWrap.className = 'result-wrap result-win';
        resultText.innerHTML = `<div style="font-size:28px;font-weight:900">${mult.toFixed(1)}x</div><div style="font-size:14px;margin-top:4px">+$${profit > 0 ? profit.toFixed(2) : '0.00'}</div>`;
        addToHistory(true, mult);
      } else {
        recordStat('loss', stake, `Plinko ${mult.toFixed(1)}x`);
        resultWrap.className = 'result-wrap result-lose';
        resultText.innerHTML = `<div style="font-size:28px;font-weight:900">${mult.toFixed(1)}x</div><div style="font-size:14px;margin-top:4px">-$${stake.toFixed(2)}</div>`;
        addToHistory(false, mult);
      }

      resultWrap.style.display = 'block';
      playing = false;
      playBtn.disabled = false;
      playBtn.style.opacity = '1';
    });
  }

  function addToHistory(won, mult){
    history.unshift({ won, mult, time: Date.now() });
    if(history.length > 30) history.pop();
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
    stakeInput.value = Math.max(0.01, (v / 2).toFixed(2));
  });
  document.getElementById('stakeDouble').addEventListener('click', function(){
    const v = parseFloat(stakeInput.value) || 1;
    stakeInput.value = (v * 2).toFixed(2);
  });

  // Play
  playBtn.addEventListener('click', play);

  // Init
  window.addEventListener('resize', resizeCanvas);
  if(document.readyState === 'complete'){
    setTimeout(initPlinko, 50);
  } else {
    window.addEventListener('load', function(){ setTimeout(initPlinko, 50); });
  }
  function initPlinko(){
    resizeCanvas();
    updateSlots();
  }
});
