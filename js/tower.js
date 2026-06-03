document.addEventListener('DOMContentLoaded', function(){
  const stakeInput = document.getElementById('stakeInput');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const playBtn = document.getElementById('playBtn');
  const collectBtn = document.getElementById('collectBtn');
  const continueBtn = document.getElementById('continueBtn');
  const stakePanel = document.getElementById('stakePanel');
  const towerGrid = document.getElementById('towerGrid');
  const resultPanel = document.getElementById('resultPanel');
  const gameStatus = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const resultLevel = document.getElementById('resultLevel');
  const resultWinnings = document.getElementById('resultWinnings');
  const bombBtns = document.querySelectorAll('.bomb-btn');
  const coefsList = document.getElementById('coefsList');

  const ROWS = 2; // 2 ряда по 5 ячеек = 10 уровней
  const COLS = 5;
  
  // Коэффициенты в зависимости от количества бомб
  const COEFS = {
    1: [1.12, 1.4, 1.75, 2.19, 2.74, 3.43, 4.29, 5.36, 6.7, 8.38],
    2: [1.5, 2.5, 4.16, 6.94, 11.57, 19.29, 32.15, 53.58, 89.3, 148.84],
    3: [2.25, 5.62, 14.06, 35.15, 87.89, 219.72, 549.31, 1373.29, 3433.22, 8583.06],
    4: [4.5, 22.5, 112.5, 562.5, 2812.5, 14062.5, 70312.5, 351562.5, 1757812.5, 8789062.5]
  };

  let gameActive = false;
  let currentBet = 0;
  let currentLevel = 0;
  let towerData = [];
  let gameEnded = false;
  let currentWinnings = 0;
  let bombCount = 1; // По умолчанию 1 бомба

  // Balance helpers
  function getBalance(){ 
    return parseFloat(localStorage.getItem('mc_balance') || '0') || 0; 
  }
  
  function setBalance(v){ 
    const n = Math.round(Number(v) * 100) / 100; 
    localStorage.setItem('mc_balance', n.toFixed(2)); 
    document.querySelectorAll('.balance-value').forEach(el=>el.textContent = n.toFixed(2)); 
  }

  // Generate tower levels
  function generateTower() {
    towerData = [];
    for(let row = 0; row < ROWS; row++) {
      const level = [];
      
      // Create array of cells
      for(let col = 0; col < COLS; col++) {
        level.push({
          isBomb: false,
          opened: false
        });
      }
      
      // Randomly place bombs (количество зависит от bombCount)
      for(let i = 0; i < bombCount; i++) {
        let bombPos = Math.floor(Math.random() * COLS);
        while(level[bombPos].isBomb) {
          bombPos = Math.floor(Math.random() * COLS);
        }
        level[bombPos].isBomb = true;
      }
      
      towerData.push(level);
    }
  }

  // Render tower grid
  function renderTower() {
    towerGrid.innerHTML = '';
    let levelIndex = 0;
    
    for(let row = 0; row < ROWS; row++) {
      const levelDiv = document.createElement('div');
      levelDiv.className = 'tower-level';
      
      for(let col = 0; col < COLS; col++) {
        const btn = document.createElement('button');
        btn.className = 'tower-cell';
        
        const cell = towerData[row][col];
        const isCurrentLevel = (levelIndex === currentLevel);
        
        if(cell.opened) {
          btn.disabled = true;
          if(cell.isBomb) {
            btn.classList.add('bomb');
            btn.textContent = '💣';
          } else {
            btn.classList.add('safe');
            btn.textContent = '✓';
          }
        } else if(isCurrentLevel) {
          btn.disabled = gameEnded;
          btn.addEventListener('click', () => openCell(row, col));
        } else {
          btn.disabled = true;
        }
        
        levelDiv.appendChild(btn);
        levelIndex++;
      }
      
      towerGrid.appendChild(levelDiv);
    }
  }

  // Open cell
  function openCell(row, col) {
    if(gameEnded) return;
    
    const cell = towerData[row][col];
    cell.opened = true;
    
    if(cell.isBomb) {
      // Game over - hit bomb
      gameEnded = true;
      gameStatus.textContent = '✗ Вы попали на бомбу!';
      gameStatus.className = 'game-status error';
      playBtn.style.display = 'none';
      collectBtn.style.display = 'none';
      continueBtn.style.display = '';
      addToHistory({ level: currentLevel, win: false });
      renderTower();
    } else {
      // Safe cell - advance to next level
      currentWinnings = calculateWinnings();
      resultWinnings.textContent = currentWinnings.toFixed(2);
      resultLevel.textContent = (currentLevel + 1);
      
      if(currentLevel < ROWS * COLS - 1) {
        currentLevel++;
        renderTower();
        gameStatus.textContent = `✓ Уровень ${currentLevel + 1} открыт!`;
        gameStatus.className = 'game-status success';
      } else {
        // Won the tower
        gameEnded = true;
        gameStatus.textContent = `✓ Вы прошли башню! Выигрыш: $${currentWinnings.toFixed(2)}`;
        gameStatus.className = 'game-status success';
        playBtn.style.display = 'none';
        collectBtn.style.display = '';
        addToHistory({ level: ROWS * COLS, win: true });
        renderTower();
      }
    }
  }

  // Calculate winnings based on level and bet
  function calculateWinnings() {
    const multiplier = COEFS[bombCount][currentLevel] || 1;
    return Math.round(currentBet * multiplier * 100) / 100;
  }

  // Event listeners
  bombBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      bombBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bombCount = parseInt(btn.dataset.bombs);
      updateCoefsDisplay();
    });
  });

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
    if(gameActive) return;

    const stake = parseFloat(stakeInput.value);
    if(isNaN(stake) || stake <= 0){
      gameStatus.textContent = 'Введите корректную ставку';
      gameStatus.className = 'game-status error';
      return;
    }

    if(stake < 0.2){
      gameStatus.textContent = 'Минимальная ставка 0.2';
      gameStatus.className = 'game-status error';
      return;
    }

    const balance = getBalance();
    if(balance < stake){
      gameStatus.textContent = 'Недостаточно средств';
      gameStatus.className = 'game-status error';
      return;
    }

    startGame(stake);
  });

  collectBtn.addEventListener('click', () => {
    const winAmount = parseFloat(resultWinnings.textContent);
    setBalance(getBalance() + winAmount);
    gameStatus.textContent = `Вы забрали $${winAmount.toFixed(2)}`;
    gameStatus.className = 'game-status success';
    resetGame();
  });

  continueBtn.addEventListener('click', () => {
    resetGame();
  });

  function startGame(stake) {
    gameActive = true;
    currentBet = stake;
    currentLevel = 0;
    gameEnded = false;
    currentWinnings = 0;

    // Deduct stake
    setBalance(getBalance() - stake);

    // Generate tower
    generateTower();

    // Hide stake panel, show tower grid
    stakePanel.style.display = 'none';
    towerGrid.style.display = 'block';
    resultPanel.style.display = 'block';

    resultLevel.textContent = '1';
    resultWinnings.textContent = '0.00';
    gameStatus.textContent = 'Выберите ячейку на первом уровне';
    gameStatus.className = 'game-status';
    playBtn.style.display = 'none';
    collectBtn.style.display = 'none';
    continueBtn.style.display = 'none';

    renderTower();
  }

  function resetGame() {
    gameActive = false;
    currentLevel = 0;
    gameEnded = false;
    currentWinnings = 0;

    stakePanel.style.display = 'block';
    towerGrid.style.display = 'none';
    resultPanel.style.display = 'none';
    gameStatus.textContent = '';
    playBtn.style.display = '';
    collectBtn.style.display = 'none';
    continueBtn.style.display = 'none';
  }

  function addToHistory(result) {
    const item = document.createElement('div');
    item.className = `history-item ${result.win ? 'win' : 'lose'}`;
    item.textContent = `${result.level}`;
    item.title = result.win ? `Выигрыш на уровне ${result.level}` : `Проигрыш на уровне ${result.level}`;
    historyScroll.insertBefore(item, historyScroll.firstChild);

    // Keep last 20 items
    while(historyScroll.children.length > 20){
      historyScroll.removeChild(historyScroll.lastChild);
    }
  }

  // Display coefficients
  function updateCoefsDisplay() {
    coefsList.innerHTML = '';
    const coefs = COEFS[bombCount];
    coefs.forEach((coef, idx) => {
      const item = document.createElement('div');
      item.className = 'coef-item';
      item.innerHTML = `<div class="level">Lvl ${idx + 1}</div><div class="multiplier">x${coef.toFixed(2)}</div>`;
      coefsList.appendChild(item);
    });
  }

  // Set initial display
  updateCoefsDisplay();

  // Set initial balance display
  document.querySelectorAll('.balance-value').forEach(el => {
    el.textContent = getBalance().toFixed(2);
  });
});
