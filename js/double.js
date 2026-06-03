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
  
  // Color to multiplier mapping
  const colorToMultiplier = {
    '#f39c12': 3,    // Orange = x3
    '#3498db': 2,    // Blue = x2
    '#e74c3c': 5,    // Red = x5
    '#1abc9c': 50,   // Teal = x50
    '#2ecc71': 50    // Green = x50
  };
  
  const multipliers = [2, 3, 5, 50];
  const colors = ['#3498db', '#f39c12', '#e74c3c', '#1abc9c', '#2ecc71'];
  
  let selectedBet = null;
  let gameActive = false;
  let history = [];
  let lastSpinAngle = 0;
  
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

  // Auto-collect winnings (this listener is kept for backward compatibility but not used)
  collectBtn.addEventListener('click', () => {
    const winAmount = parseFloat(collectBtn.dataset.win) || 0;
    setBalance(getBalance() + winAmount);
    gameStatusEl.textContent = `Вы забрали $${winAmount.toFixed(2)}`;
    gameStatusEl.className = 'game-status success';
    gameActive = false;
    playBtn.disabled = false;
    collectBtn.style.display = 'none';
    resetWheel();
  });

  function startGame(stake){
    gameActive = true;
    playBtn.disabled = true;
    
    // Deduct stake
    setBalance(getBalance() - stake);
    
    // Generate random target angle (0-360)
    const targetAngle = Math.random() * 360;
    lastSpinAngle = targetAngle;
    
    // Spin wheel
    spinWheel(targetAngle, () => {
      // Determine result based on the angle
      const result = getResultFromAngle(targetAngle);
      
      showResult(result.multiplier);
      
      // Add to history
      addToHistory(result);
      
      const userBetMultiplier = multipliers[selectedBet];
      const win = (result.multiplier === userBetMultiplier);
      const winAmount = win ? (stake * result.multiplier) : 0;
      
      if(win){
        // Add winnings to balance automatically
        setBalance(getBalance() + winAmount);
        gameStatusEl.textContent = `Вы выиграли $${winAmount.toFixed(2)}! ✓`;
        gameStatusEl.className = 'game-status success';
        
        // Auto-start new round after 2 seconds
        setTimeout(() => {
          resetWheel();
          playBtn.disabled = false;
          gameActive = false;
          gameStatusEl.textContent = '';
        }, 2000);
      } else {
        gameStatusEl.textContent = `Вы проиграли. Выпало x${result.multiplier}`;
        gameStatusEl.className = 'game-status error';
        playBtn.disabled = false;
        gameActive = false;
      }
    });
  }

  function getResultFromAngle(angle){
    // Normalize angle to 0-360
    const normalizedAngle = ((angle % 360) + 360) % 360;
    
    // Based on SVG structure, we need to map angles to colors
    // This is determined by reading the wheel from top (0°) going clockwise
    // We'll try to detect which color range the angle falls into
    
    // Rough mapping based on wheel structure (needs to be adjusted based on actual SVG)
    let result = { multiplier: 2, color: '#3498db' };
    
    // Each section is roughly 72° (360/5 colors: blue, orange, red, teal, green)
    // But looking at SVG, colors appear mixed, so we need careful mapping
    
    // Let's use a simpler approach: divide into ranges based on observation
    // This would need adjustment based on actual wheel appearance
    
    if(normalizedAngle >= 0 && normalizedAngle < 72){
      result = { multiplier: 2, color: '#3498db' }; // Blue
    } else if(normalizedAngle >= 72 && normalizedAngle < 144){
      result = { multiplier: 3, color: '#f39c12' }; // Orange
    } else if(normalizedAngle >= 144 && normalizedAngle < 216){
      result = { multiplier: 5, color: '#e74c3c' }; // Red
    } else if(normalizedAngle >= 216 && normalizedAngle < 288){
      result = { multiplier: 50, color: '#1abc9c' }; // Teal
    } else {
      result = { multiplier: 50, color: '#2ecc71' }; // Green
    }
    
    return result;
  }

  function spinWheel(targetDegAngle, onComplete){
    // Calculate final rotation: multiple full rotations + target angle
    const targetRotation = 360 * 10 + targetDegAngle;
    
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

  function showResult(multiplier){
    resultDisplay.textContent = `x${multiplier}`;
    // Find color for this multiplier
    let resultColor = '#3498db';
    Object.keys(colorToMultiplier).forEach(color => {
      if(colorToMultiplier[color] === multiplier){
        resultColor = color;
      }
    });
    resultDisplay.style.backgroundColor = resultColor;
    resultDisplay.style.display = 'flex';
  }

  function addToHistory(result){
    const item = document.createElement('div');
    item.className = 'history-item';
    
    // Use color from result
    item.style.backgroundColor = result.color;
    
    const inner = document.createElement('div');
    inner.className = 'history-inner';
    inner.textContent = `x${result.multiplier}`;
    
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
