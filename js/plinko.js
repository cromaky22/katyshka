document.addEventListener('DOMContentLoaded', function(){
  function recordStat(type, amount, detail){
    try{
      var uid = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: uid, type, amount: Math.abs(amount), detail: detail || 'Plinko'})
      }).catch(function(){});
    }catch(e){}
  }

  var canvas = document.getElementById('plinkoCanvas');
  var ctx = canvas.getContext('2d');
  var ballsContainer = document.getElementById('plinkoBalls');
  var slotsContainer = document.getElementById('plinkoSlots');
  var stakeInput = document.getElementById('stakeInput');
  var playBtn = document.getElementById('playBtn');
  var gameStatus = document.getElementById('gameStatus');
  var phList = document.getElementById('phList');

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  var risk = 'low';
  var rows = 16;
  var ballCount = 1;
  var playing = false;
  var history = [];
  var activeBalls = 0;
  var roundResults = [];
  var pinPositions = [];

  // Multipliers — as requested by user
  var MULTS = {
    low: {
      8:  [2.8, 1.6, 1, 0.9, 0.8, 0.9, 1, 1.6, 2.8],
      10: [3.7, 2, 1.3, 1, 0.9, 0.8, 0.9, 1, 1.3, 2, 3.7],
      12: [5.3, 2.6, 1.6, 1.1, 0.9, 0.8, 0.9, 1, 1.1, 1.6, 2.6, 5.3],
      14: [8.3, 4, 2.4, 1.6, 1.2, 1, 0.8, 0.8, 1, 1.2, 1.6, 2.4, 4, 8.3],
      16: [12, 5.2, 2.9, 1.9, 1.4, 1.1, 0.9, 0.9, 0.8, 0.9, 0.9, 1.1, 1.4, 1.9, 2.9, 5.2, 12]
    },
    medium: {
      8:  [6, 2.1, 1.1, 0.8, 0.7, 0.8, 1.1, 2.1, 6],
      10: [13, 3.9, 1.8, 1, 0.7, 0.7, 1, 1.8, 3.9, 13],
      12: [24, 6.7, 2.7, 1.4, 1, 0.7, 0.7, 0.7, 1, 1.4, 2.7, 6.7, 24],
      14: [47, 12, 4.5, 2.3, 1.3, 0.9, 0.7, 0.7, 0.7, 0.9, 1.3, 2.3, 4.5, 12, 47],
      16: [90, 22, 7.5, 3.4, 1.8, 1.2, 0.9, 0.7, 0.7, 0.7, 0.9, 1.2, 1.8, 3.4, 7.5, 22, 90]
    },
    high: {
      8:  [16, 3.1, 1.1, 0.6, 0.5, 0.6, 1.1, 3.1, 16],
      10: [43, 6.6, 1.9, 0.9, 0.6, 0.5, 0.9, 1.9, 6.6, 43],
      12: [130, 17, 4.2, 1.5, 0.8, 0.5, 0.5, 0.5, 0.8, 1.5, 4.2, 17, 130],
      14: [360, 41, 8.9, 2.9, 1.3, 0.7, 0.5, 0.5, 0.5, 0.7, 1.3, 2.9, 8.9, 41, 360],
      16: [1100, 110, 21, 6, 2.2, 1.1, 0.7, 0.5, 0.4, 0.5, 0.7, 1.1, 2.2, 6, 21, 110, 1100]
    }
  };

  function getMults(){ return MULTS[risk][rows] || MULTS.medium[16]; }

  // 97% to slots with mult <= 1.9, 3% to big wins (> 1.9x)
  function getRandomSlot(mults){
    var weights = [];
    for(var i = 0; i < mults.length; i++){
      if(mults[i] <= 1.9){
        weights.push(25.0);
      } else {
        weights.push(0.5);
      }
    }
    var total = 0;
    for(var j = 0; j < weights.length; j++) total += weights[j];
    var rand = Math.random() * total;
    for(var k = 0; k < weights.length; k++){
      rand -= weights[k];
      if(rand <= 0) return k;
    }
    return Math.floor(mults.length / 2);
  }

  function resizeCanvas(){
    var wrap = canvas.parentElement;
    if(!wrap) return;
    var dpr = window.devicePixelRatio || 1;
    var rect = wrap.getBoundingClientRect();
    if(rect.width < 10 || rect.height < 10) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    calcPinPositions();
    drawBoard();
  }

  function calcPinPositions(){
    if(canvas.width === 0) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    var topY = 20;
    var bottomY = h - 20;
    var centerX = w / 2;
    var topWidth = w * 0.12;
    var botWidth = w * 0.88;

    pinPositions = [];
    for(var r = 0; r < rows; r++){
      var t = r / (rows - 1);
      var y = topY + (bottomY - topY) * t;
      var rowWidth = topWidth + (botWidth - topWidth) * t;
      var pinsInRow = r + 2;
      var rowPins = [];
      var spacing = rowWidth / (pinsInRow + 1);
      var startX = centerX - rowWidth / 2;
      for(var p = 0; p < pinsInRow; p++){
        var x = startX + spacing * (p + 1);
        rowPins.push({x: x, y: y});
      }
      pinPositions.push(rowPins);
    }
  }

  function drawBoard(){
    if(canvas.width === 0 || pinPositions.length === 0) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    for(var r = 0; r < pinPositions.length; r++){
      var row = pinPositions[r];
      for(var p = 0; p < row.length; p++){
        var pin = row[p];
        ctx.fillStyle = 'rgba(139,92,246,0.2)';
        ctx.beginPath(); ctx.arc(pin.x, pin.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(pin.x, pin.y, 1.5, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  function getSlotColor(m){
    if(m >= 100) return 'linear-gradient(180deg,#e879f9,#d946ef)';
    if(m >= 50) return 'linear-gradient(180deg,#c084fc,#a855f7)';
    if(m >= 20) return 'linear-gradient(180deg,#f472b6,#ec4899)';
    if(m >= 5) return 'linear-gradient(180deg,#fb923c,#f97316)';
    if(m >= 2) return 'linear-gradient(180deg,#facc15,#eab308)';
    if(m >= 1) return 'linear-gradient(180deg,#4ade80,#22c55e)';
    return 'linear-gradient(180deg,#374151,#1f2937)';
  }

  function updateSlots(){
    var mults = getMults();
    slotsContainer.innerHTML = '';
    for(var i = 0; i < mults.length; i++){
      var m = mults[i];
      var div = document.createElement('div');
      div.className = 'plinko-slot';
      div.textContent = m >= 100 ? Math.round(m)+'x' : m.toFixed(1)+'x';
      div.style.background = getSlotColor(m);
      slotsContainer.appendChild(div);
    }
  }

  function dropSingleBall(stake, mults, onBallDone){
    var finalSlot = getRandomSlot(mults);
    var mult = mults[finalSlot];

    var dpr = window.devicePixelRatio || 1;
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    if(w === 0) w = 300;
    if(h === 0) h = 300;

    var padding = 20;
    var usableW = w - padding * 2;
    var slotWidth = usableW / mults.length;
    var targetX = padding + slotWidth * finalSlot + slotWidth / 2;
    var targetY = h - 12;

    var ball = document.createElement('div');
    ball.className = 'plinko-ball';
    ball.style.background = 'radial-gradient(circle at 35% 35%,#ffd700,#ff8c00)';
    ball.style.boxShadow = '0 0 6px rgba(255,200,0,0.8)';
    ballsContainer.appendChild(ball);

    var frame = 0;
    var totalFrames = rows * 8;
    var startX = w / 2;
    var pinStartY = 20;
    var pinEndY = h - 20;

    function animate(){
      frame++;
      var progress = frame / totalFrames;
      var y = pinStartY + (pinEndY - pinStartY) * progress;
      var x = startX + (targetX - startX) * progress + Math.sin(progress * rows * Math.PI) * 8 * (1 - progress);
      ball.style.left = (x - 5) + 'px';
      ball.style.top = (y - 5) + 'px';

      if(frame < totalFrames){
        requestAnimationFrame(animate);
      } else {
        ball.style.left = (targetX - 5) + 'px';
        ball.style.top = (targetY - 5) + 'px';
        if(mult >= 1){
          ball.style.background = 'radial-gradient(circle at 35% 35%,#4ade80,#22c55e)';
          ball.style.boxShadow = '0 0 8px rgba(46,227,107,0.9)';
        } else {
          ball.style.background = 'radial-gradient(circle at 35% 35%,#f87171,#ef4444)';
          ball.style.boxShadow = '0 0 8px rgba(244,67,54,0.9)';
        }
        setTimeout(function(){
          ball.style.transition = 'opacity 0.3s';
          ball.style.opacity = '0';
          setTimeout(function(){ ball.remove(); }, 300);
          addHistory(mult >= 1, mult);
          onBallDone(mult);
        }, 350);
      }
    }
    animate();
  }

  function play(){
    if(playing) return;
    var stake = parseFloat(stakeInput.value);
    if(isNaN(stake) || stake < 0.01){
      gameStatus.textContent = 'Мин. ставка $0.01';
      gameStatus.className = 'game-status lose';
      return;
    }
    var totalCost = stake * ballCount;
    if(getBalance() < totalCost){
      gameStatus.textContent = 'Недостаточно средств';
      gameStatus.className = 'game-status lose';
      return;
    }

    playing = true;
    playBtn.disabled = true;
    gameStatus.textContent = '🎱 ' + ballCount + ' шарик(ов)...';
    gameStatus.className = 'game-status';

    setBalance(getBalance() - totalCost);
    recordStat('bet', totalCost, 'Plinko x'+ballCount);

    var mults = getMults();
    activeBalls = ballCount;
    roundResults = [];

    for(var i = 0; i < ballCount; i++){
      (function(idx){
        setTimeout(function(){
          dropSingleBall(stake, mults, function(mult){
            roundResults.push(mult);
            activeBalls--;
            if(activeBalls === 0){
              finishRound(stake);
            }
          });
        }, idx * 180);
      })(i);
    }
  }

  // Show result overlay on the board
  function showResultOnBoard(profit, wins, losses){
    var wrap = canvas.parentElement;
    if(!wrap) return;

    // Remove existing result
    var existing = wrap.querySelector('.plinko-result-overlay');
    if(existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'plinko-result-overlay';

    var color = profit > 0 ? '#2ee36b' : '#f44336';
    var sign = profit > 0 ? '+' : '';
    var emoji = profit > 0 ? '🎉' : '💀';

    overlay.innerHTML = `
      <div class="plinko-result-content">
        <div class="plinko-result-emoji">${emoji}</div>
        <div class="plinko-result-amount" style="color:${color}">${sign}$${profit.toFixed(2)}</div>
        <div class="plinko-result-detail">${wins} win / ${losses} loss</div>
      </div>
    `;

    wrap.appendChild(overlay);

    // Auto remove after 2.5 seconds
    setTimeout(function(){
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      setTimeout(function(){ overlay.remove(); }, 500);
    }, 2500);
  }

  function finishRound(stake){
    var totalWin = 0;
    var wins = 0, losses = 0;

    for(var i = 0; i < roundResults.length; i++){
      var mult = roundResults[i];
      var winAmount = Math.round(stake * mult * 100) / 100;
      totalWin += winAmount;
      if(mult >= 1){
        wins++;
        if(mult > 1) recordStat('win', winAmount, 'Plinko '+mult.toFixed(1)+'x');
      } else {
        losses++;
        recordStat('loss', stake - winAmount, 'Plinko '+mult.toFixed(1)+'x');
      }
    }

    var profit = totalWin - (stake * ballCount);
    setBalance(getBalance() + totalWin);

    // Show result on board
    showResultOnBoard(profit, wins, losses);

    // Also update text below
    if(profit > 0){
      gameStatus.innerHTML = '<span style="font-size:20px;font-weight:900">🎉 +$' + profit.toFixed(2) + '</span><br><span style="font-size:12px">' + wins + ' win / ' + losses + ' loss</span>';
      gameStatus.className = 'game-status win';
    } else {
      gameStatus.innerHTML = '<span style="font-size:20px;font-weight:900">💀 -$' + Math.abs(profit).toFixed(2) + '</span><br><span style="font-size:12px">' + wins + ' win / ' + losses + ' loss</span>';
      gameStatus.className = 'game-status lose';
    }

    playing = false;
    playBtn.disabled = false;
  }

  function addHistory(won, mult){
    history.unshift({won: won, mult: mult});
    if(history.length > 50) history.pop();
    renderHistory();
  }

  function renderHistory(){
    phList.innerHTML = '';
    for(var i = 0; i < history.length; i++){
      var h = history[i];
      var item = document.createElement('div');
      item.className = 'ph-item ' + (h.won ? 'ph-win' : 'ph-lose');
      item.textContent = h.mult.toFixed(1) + 'x';
      phList.appendChild(item);
    }
  }

  // Event listeners
  document.getElementById('riskBtns').addEventListener('click', function(e){
    var btn = e.target.closest('.plk-btn');
    if(!btn) return;
    var parent = document.getElementById('riskBtns');
    var btns = parent.querySelectorAll('.plk-btn');
    for(var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    btn.classList.add('active');
    risk = btn.dataset.risk;
    updateSlots();
  });

  document.getElementById('rowsBtns').addEventListener('click', function(e){
    var btn = e.target.closest('.plk-btn');
    if(!btn) return;
    var parent = document.getElementById('rowsBtns');
    var btns = parent.querySelectorAll('.plk-btn');
    for(var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    btn.classList.add('active');
    rows = parseInt(btn.dataset.rows);
    updateSlots();
    resizeCanvas();
  });

  document.getElementById('ballBtns').addEventListener('click', function(e){
    var btn = e.target.closest('.plk-btn');
    if(!btn) return;
    var parent = document.getElementById('ballBtns');
    var btns = parent.querySelectorAll('.plk-btn');
    for(var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    btn.classList.add('active');
    ballCount = parseInt(btn.dataset.count);
  });

  document.getElementById('halfBtn').addEventListener('click', function(){
    var v = parseFloat(stakeInput.value) || 1;
    stakeInput.value = Math.max(0.01, (v/2).toFixed(2));
  });
  document.getElementById('doubleBtn').addEventListener('click', function(){
    var v = parseFloat(stakeInput.value) || 1;
    stakeInput.value = (v*2).toFixed(2);
  });

  playBtn.addEventListener('click', play);
  window.addEventListener('resize', resizeCanvas);

  // Init
  function doInit(){
    resizeCanvas();
    updateSlots();
  }

  if(document.readyState === 'complete'){
    setTimeout(doInit, 100);
  } else {
    window.addEventListener('load', function(){
      setTimeout(doInit, 100);
    });
  }
});
