document.addEventListener('DOMContentLoaded', function(){
  const wheel = document.getElementById('wheel');
  const pointer = document.getElementById('pointer');
  const resultDisplay = document.getElementById('resultDisplay');
  const stakeInput = document.getElementById('stakeInput');
  const playBtn = document.getElementById('playBtn');
  const collectBtn = document.getElementById('collectBtn');
  const gameStatusEl = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  
  const betBtns = document.querySelectorAll('.bet-btn');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  
  // Multiplier values: x2, x3, x5, x50
  const multipliers = [2, 3, 5, 50];
  const colors = ['#2196f3', '#ffc107', '#ff5722', '#8bc34a'];
  
  let selectedBet = null;
  let gameActive = false;
  let history = [];
  
  // Balance helpers
  function getBalance(){ 
    return parseFloat(localStorage.getItem('mc_balance') || '0') || 0; 
  }
  function setBalance(v){ 
    const n = Math.round(Number(v) * 100) / 100; 
    localStorage.setItem('mc_balance', n.toFixed(2)); 
    document.querySelectorAll('.balance-value').forEach(el=>el.textContent = n.toFixed(2)); 
  }

  // Bet button selection
  betBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      betBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedBet = parseInt(btn.dataset.index);
    });
  });

  // Quick bet buttons
  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      const currentValue = parseFloat(stakeInput.value) || 0;
      const newValue = currentValue + amount;
      stakeInput.value = Math.min(200, Math.max(0.5, newValue)).toFixed(2);
    });
  });

  // Stake input helpers
  halfBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.max(0.5, val / 2);
  });

  doubleBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.min(200, val * 2);
  });

  // Play button
  playBtn.addEventListener('click', () => {
    if(selectedBet === null){
      gameStatusEl.textContent = 'Выберите множитель';
      gameStatusEl.className = 'game-status error';
      return;
    }
    
    const stake = parseFloat(stakeInput.value);
    if(isNaN(stake) || stake <= 0){
      gameStatusEl.textContent = 'Введите корректную ставку';
      gameStatusEl.className = 'game-status error';
      return;
    }
    
    const balance = getBalance();
    if(balance < stake){
      gameStatusEl.textContent = 'Недостаточно средств';
      gameStatusEl.className = 'game-status error';
      return;
    }
    
    startGame(stake);
  });

  // Collect winnings
  collectBtn.addEventListener('click', () => {
    const winAmount = parseFloat(collectBtn.dataset.win) || 0;
    setBalance(getBalance() + winAmount);
    gameStatusEl.textContent = `Вы забрали $${winAmount.toFixed(2)}`;
    gameStatusEl.className = 'game-status success';
    gameActive = false;
    playBtn.style.display = '';
    collectBtn.style.display = 'none';
    resetWheel();
  });

  function startGame(stake){
    gameActive = true;
    playBtn.disabled = true;
    
    // Deduct stake
    setBalance(getBalance() - stake);
    
    // Random result (0-3 index)
    const result = Math.floor(Math.random() * 4);
    const resultMultiplier = multipliers[result];
    const userBetMultiplier = multipliers[selectedBet];
    const win = (selectedBet === result);
    const winAmount = win ? (stake * resultMultiplier) : 0;
    
    // Spin wheel
    spinWheel(result, () => {
      showResult(win, winAmount, stake, result);
      
      // Add to history
      addToHistory(userBetMultiplier, resultMultiplier, win);
      
      if(win){
        gameStatusEl.textContent = `Вы выиграли $${winAmount.toFixed(2)}!`;
        gameStatusEl.className = 'game-status success';
        playBtn.style.display = 'none';
        collectBtn.style.display = '';
        collectBtn.data = { win: winAmount };
        collectBtn.dataset.win = winAmount;
      } else {
        gameStatusEl.textContent = `Вы проиграли. Выпало x${resultMultiplier}`;
        gameStatusEl.className = 'game-status error';
        playBtn.disabled = false;
        gameActive = false;
      }
    });
  }

  function spinWheel(resultIndex, onComplete){
    // Angles to center of each segment - 4 equal segments
    // Each segment is 90° apart for even distribution
    const getDeg = [0, 90, 180, 270];
    const targetDeg = getDeg[resultIndex];
    
    // Calculate final rotation: 150 + 10 full rotations (360*10) + target angle
    const targetRotation = 150 + 360 * 10 + targetDeg;
    
    // Get pointer and set up animation
    const pointer = document.querySelector('.pointer');
    
    // Reset to initial state
    pointer.style.transition = 'none';
    pointer.style.transform = 'rotateZ(0deg)';
    
    // Force reflow to apply reset
    void pointer.offsetWidth;
    
    // Apply spinning animation
    pointer.style.transition = 'transform 12s cubic-bezier(0.17, 0.67, 0.12, 0.98)';
    pointer.style.transform = `rotateZ(${targetRotation}deg)`;
    
    setTimeout(onComplete, 12000);
  }

  function resetWheel(){
    const pointer = document.querySelector('.pointer');
    pointer.style.transition = 'none';
    pointer.style.transform = 'rotateZ(0deg)';
    // Hide result when resetting
    resultDisplay.style.display = 'none';
  }

  function showResult(win, winAmount, stake, resultIndex){
    const resultMult = multipliers[resultIndex];
    const colorMap = ['#2196f3', '#ffc107', '#ff5722', '#8bc34a'];
    resultDisplay.textContent = `x${resultMult}`;
    resultDisplay.style.backgroundColor = colorMap[resultIndex];
    resultDisplay.style.display = 'flex';
  }

  function addToHistory(bet, result, win){
    const item = document.createElement('div');
    item.className = 'history-item';
    const colorMap = ['#2196f3', '#ffc107', '#ff5722', '#8bc34a'];
    const resultIndex = multipliers.indexOf(result);
    item.style.backgroundColor = colorMap[resultIndex];
    
    const inner = document.createElement('div');
    inner.className = 'history-inner';
    inner.textContent = `x${result}`;
    
    item.appendChild(inner);
    historyScroll.insertBefore(item, historyScroll.firstChild);
    
    // Keep last 20 items
    while(historyScroll.children.length > 20){
      historyScroll.removeChild(historyScroll.lastChild);
    }
  }

  // Set initial balance display
  document.querySelectorAll('.balance-value').forEach(el => {
    el.textContent = getBalance().toFixed(2);
  });

  // Select first bet by default
  betBtns[0].click();
});
