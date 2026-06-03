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

  const ROWS = 2;
  const COLS = 5;
  const TOTAL_LEVELS = ROWS * COLS; // 10 уровней
  
  // Коэффициенты в зависимости от количества бомб
  const COEFS = {
    1: [1.12, 1.4, 1.75, 2.19, 2.74, 3.43, 4.29, 5.36, 6.7, 8.38],
    2: [1.5, 2.5, 4.16, 6.94, 11.57, 19.29, 32.15, 53.58, 89.3, 148.84],
    3: [2.25, 5.62, 14.06, 35.15, 87.89, 219.72, 549.31, 1373.29, 3433.22, 8583.06],
    4: [4.5, 22.5, 112.5, 562.5, 2812.5, 14062.5, 70312.5, 351562.5, 1757812.5, 8789062.5]
  };

  let gameState = 'selecting'; // selecting -> playing -> result
  let bombCount = 1;
  let currentBet = 0;
  let currentLevel = 0; // 0-9
  let towerData = [];
  let currentWinnings = 0;

  // Balance helpers
  function getBalance(){ 
    return parseFloat(localStorage.getItem('mc_balance') || '0') || 0; 
  }
  
  function setBalance(v){ 
    const n = Math.round(Number(v) * 100) / 100; 
    localStorage.setItem('mc_balance', n.toFixed(2)); 
    document.querySelectorAll('.balance-value').forEach(el=>el.textContent = n.toFixed(2)); 
  }

  // Generate tower - создаёт 10 уровней с случайными бомбами
  function generateTower() {
    towerData = [];
    for(let level = 0; level < TOTAL_LEVELS; level++) {
      const cells = [];
      for(let col = 0; col < COLS; col++) {
        cells.push({ isBomb: false });
      }
      
      // Случайно размещаем бомбы
      for(let i = 0; i < bombCount; i++) {
        let pos = Math.floor(Math.random() * COLS);
        while(cells[pos].isBomb) {
          pos = Math.floor(Math.random() * COLS);
        }
        cells[pos].isBomb = true;
      }
      
      towerData.push(cells);
    }
  }

  function formatCoef(v) {
    if(v >= 1000000) {
      return (v / 1000000).toFixed(2) + 'M';
    } else if(v >= 1000) {
      return (v / 1000).toFixed(2) + 'K';
    }
    return v.toFixed(2);
  }

  function updateCoefsDisplay() {
    coefsList.innerHTML = '';
    const coefs = COEFS[bombCount];
    coefs.forEach((coef, idx) => {
      const item = document.createElement('div');
      item.className = 'coef-item';
      item.innerHTML = `<div class="level">Lvl ${idx + 1}</div><div class="multiplier">x${formatCoef(coef)}</div>`;
      coefsList.appendChild(item);
    });
  }

  function renderGrid() {
    towerGrid.innerHTML = '';
    let cellIndex = 0;
    
    for(let row = 0; row < ROWS; row++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'tower-level';
      
      // Показываем уровень и коэффициент слева
      const levelInfo = document.createElement('div');
      levelInfo.className = 'level-info';
      const coef = COEFS[bombCount][row * COLS];
      levelInfo.innerHTML = `
        <div class="level-number">Lvl ${row + 1}</div>
        <div class="level-coef">x${formatCoef(coef)}</div>
      `;
      rowDiv.appendChild(levelInfo);
      
      // Ячейки
      const cellsDiv = document.createElement('div');
      cellsDiv.className = 'cells-row';
      
      for(let col = 0; col < COLS; col++) {
        const levelIndex = row * COLS + col;
        const btn = document.createElement('button');
        btn.className = 'tower-cell';
        
        const cell = towerData[levelIndex];
        const isCurrentLevel = (levelIndex === currentLevel);
        const isPlayable = isCurrentLevel && gameState === 'playing';
        const isPastLevel = levelIndex < currentLevel;
        
        if(isPlayable) {
          // Текущий уровень - кликабельны все ячейки
          btn.addEventListener('click', () => openCell(levelIndex, col));
          btn.textContent = '?';
        } else if(isPastLevel) {
          // Прошлые уровни - показываем результат
          btn.disabled = true;
          if(cell.opened) {
            btn.textContent = cell.isBomb ? '💣' : '✓';
            btn.classList.add(cell.isBomb ? 'bomb' : 'safe');
          }
        } else {
          // Будущие уровни
          btn.disabled = true;
          btn.textContent = '?';
        }
        
        cellsDiv.appendChild(btn);
      }
      
      rowDiv.appendChild(cellsDiv);
      towerGrid.appendChild(rowDiv);
    }
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
    stakeInput.value = Math.min(10000000, (val * 2).toFixed(2));
  });

  playBtn.addEventListener('click', () => {
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

    if(getBalance() < stake){
      gameStatus.textContent = 'Недостаточно средств';
      gameStatus.className = 'game-status error';
      return;
    }

    startGame(stake);
  });

  collectBtn.addEventListener('click', () => {
    setBalance(getBalance() + currentWinnings);
    gameStatus.textContent = `Вы забрали $${currentWinnings.toFixed(2)}`;
    gameStatus.className = 'game-status success';
    resetGame();
  });

  continueBtn.addEventListener('click', () => {
    resetGame();
  });

  function startGame(stake) {
    currentBet = stake;
    currentLevel = 0;
    currentWinnings = 0;
    gameState = 'playing';

    setBalance(getBalance() - stake);
    generateTower();

    stakePanel.style.display = 'none';
    towerGrid.style.display = 'block';
    resultPanel.style.display = 'block';

    resultLevel.textContent = '0';
    resultWinnings.textContent = '0.00';
    gameStatus.textContent = 'Выберите ячейку на первом уровне';
    gameStatus.className = 'game-status';
    playBtn.style.display = 'none';
    collectBtn.style.display = 'none';
    continueBtn.style.display = 'none';

    renderGrid();
  }

  function resetGame() {
    gameState = 'selecting';
    currentLevel = 0;
    currentWinnings = 0;
    towerData = [];

    stakePanel.style.display = 'block';
    towerGrid.style.display = 'none';
    resultPanel.style.display = 'none';
    gameStatus.textContent = '';
    playBtn.style.display = '';
    collectBtn.style.display = 'none';
    continueBtn.style.display = 'none';
  }

  function openCell(levelIndex, cellCol) {
    if(gameState !== 'playing') return;
    
    const cell = towerData[levelIndex][cellCol];
    cell.opened = true;
    
    if(cell.isBomb) {
      gameStatus.textContent = '✗ Вы попали на бомбу!';
      gameStatus.className = 'game-status error';
      gameState = 'result';
      continueBtn.style.display = '';
      collectBtn.style.display = 'none';
      addToHistory({ level: levelIndex + 1, win: false, bombs: bombCount });
      renderGrid();
    } else {
      if(levelIndex < TOTAL_LEVELS - 1) {
        currentLevel++;
        currentWinnings = currentBet * COEFS[bombCount][currentLevel - 1];
        resultWinnings.textContent = currentWinnings.toFixed(2);
        resultLevel.textContent = currentLevel;
        gameStatus.textContent = `✓ Открыт уровень ${currentLevel + 1}`;
        gameStatus.className = 'game-status success';
        renderGrid();
      } else {
        currentWinnings = currentBet * COEFS[bombCount][TOTAL_LEVELS - 1];
        resultWinnings.textContent = currentWinnings.toFixed(2);
        resultLevel.textContent = TOTAL_LEVELS;
        gameStatus.textContent = '✓ Вы прошли башню!';
        gameStatus.className = 'game-status success';
        gameState = 'result';
        collectBtn.style.display = '';
        continueBtn.style.display = 'none';
        addToHistory({ level: TOTAL_LEVELS, win: true, bombs: bombCount });
        renderGrid();
      }
    }
  }

  // Initialize
  updateCoefsDisplay();
  document.querySelectorAll('.balance-value').forEach(el => {
    el.textContent = getBalance().toFixed(2);
  });
});
