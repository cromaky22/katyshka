document.addEventListener('DOMContentLoaded', function(){
  const stakeInput = document.getElementById('stakeInput');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const playBtn = document.getElementById('playBtn');
  const collectBtn = document.getElementById('collectBtn');
  const continueBtn = document.getElementById('continueBtn');
  const stakePanel = document.getElementById('stakePanel');
  const gamePanel = document.getElementById('gamePanel');
  const towerGrid = document.querySelector('.tower-grid');
  const levelsSidebar = document.getElementById('levelsSidebar');
  const gameStatus = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const winningsAmount = document.getElementById('winningsAmount');
  const coefsContainer = document.getElementById('coefsContainer');

  const ROWS = 2;
  const COLS = 5;
  const TOTAL_LEVELS = ROWS * COLS;
  const HOUSE_EDGE = 0.06; // 10 уровней
  
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
  let gameHistory = [];
  let showAllBombs = false; // флаг для раскрытия всех бомб после проигрыша

  // Balance helpers
  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  // Generate tower - создаёт 10 уровней с случайными бомбами
  function generateTower() {
    towerData = [];
    for(let level = 0; level < TOTAL_LEVELS; level++) {
      const cells = [];
      for(let col = 0; col < COLS; col++) {
        cells.push({ isBomb: false, opened: false });
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
    coefsContainer.innerHTML = '';
    const coefs = COEFS[bombCount];
    coefs.forEach((coef, idx) => {
      const item = document.createElement('div');
      item.className = 'coef-item';
      item.innerHTML = `<div class="level">Lvl ${idx + 1}</div><div class="multiplier">x${formatCoef(coef)}</div>`;
      coefsContainer.appendChild(item);
    });
  }

  function renderGrid() {
    // Рендер левой панели уровней (снизу вверх - от 10 к 1)
    levelsSidebar.innerHTML = '';
    const coefs = COEFS[bombCount];
    for(let level = TOTAL_LEVELS - 1; level >= 0; level--) {
      const levelBar = document.createElement('div');
      levelBar.className = 'level-bar';
      
      if(level === currentLevel && gameState === 'playing') {
        levelBar.classList.add('current');
      } else if(level < currentLevel) {
        levelBar.classList.add('passed');
      }
      
      levelBar.innerHTML = `
        <div class="level-number">Lvl ${level + 1}</div>
        <div class="level-multiplier">x${formatCoef(coefs[level])}</div>
      `;
      levelsSidebar.appendChild(levelBar);
    }

    // Рендер сетки ячеек (снизу вверх - от 9 к 0)
    towerGrid.innerHTML = '';
    
    for(let level = TOTAL_LEVELS - 1; level >= 0; level--) {
      const cells = towerData[level];
      const isCurrentLevel = (level === currentLevel);
      const isPastLevel = level < currentLevel;
      
      for(let col = 0; col < COLS; col++) {
        const btn = document.createElement('button');
        btn.className = 'tower-cell';
        
        const cell = cells[col];
        
        if(isCurrentLevel && gameState === 'playing') {
          // Текущий уровень - кликабельны все ячейки
          btn.addEventListener('click', () => openCell(level, col));
          btn.textContent = '?';
          btn.classList.add('current');
        } else if(isCurrentLevel && gameState === 'result' && cell.opened) {
          // Текущий уровень после результата - показываем открытые ячейки
          btn.disabled = true;
          if(cell.isBomb) {
            btn.textContent = '💣';
            btn.classList.add('bomb');
          } else {
            btn.textContent = '✓';
            btn.classList.add('safe');
          }
        } else if(isPastLevel) {
          // Прошлые уровни
          btn.disabled = true;
          if(cell.opened) {
            // Открытые ячейки показываем всегда
            if(cell.isBomb) {
              btn.textContent = '💣';
              btn.classList.add('bomb');
            } else {
              btn.textContent = '✓';
              btn.classList.add('safe');
            }
          } else if(showAllBombs && cell.isBomb) {
            // Неоткрытые бомбы показываем только если showAllBombs = true
            btn.textContent = '💣';
            btn.classList.add('bomb');
          } else {
            // Закрытые ячейки остаются закрытыми
            btn.textContent = '?';
          }
        } else {
          // Будущие уровни
          btn.disabled = true;
          btn.textContent = '?';
        }
        
        towerGrid.appendChild(btn);
      }
    }
  }

  // Event listeners для выбора количества бомб
  document.querySelectorAll('.bomb-control-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const op = e.target.textContent;
      if(op === '−') {
        bombCount = Math.max(1, bombCount - 1);
      } else if(op === '+') {
        bombCount = Math.min(4, bombCount + 1);
      }
      updateBombDisplay();
      updateCoefsDisplay();
    });
  });

  function updateBombDisplay() {
    const bombCountText = document.getElementById('bombCountText');
    const bombCountLabel = document.getElementById('bombCountLabel');
    const bombIcons = document.getElementById('bombIcons');
    
    bombCountText.textContent = bombCount;
    bombCountLabel.textContent = bombCount === 1 ? 'БОМБА' : 'БОМБ';
    
    bombIcons.innerHTML = '';
    for(let i = 0; i < bombCount; i++) {
      const icon = document.createElement('div');
      icon.className = 'bomb-icon';
      icon.textContent = '💣';
      bombIcons.appendChild(icon);
    }
  }

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
    stakeInput.value = Math.max(0.1, (val / 2).toFixed(2));
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

    if(stake < 0.1){
      gameStatus.textContent = 'Минимальная ставка 0.1';
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
     if(window.mcStats) mcStats.addWin(currentWinnings, 'Tower', `Уровень ${currentLevel}, ${bombCount} бомб`);
     setBalance(getBalance() + currentWinnings);
    gameStatus.textContent = `Вы забрали $${currentWinnings.toFixed(2)}`;
    gameStatus.className = 'game-status success';
    // Добавляем в историю ставку на уровне, где остановился
    addToHistory({ level: currentLevel, win: true, bombs: bombCount, winnings: currentWinnings });
    resetGame();
  });

  continueBtn.addEventListener('click', () => {
    // Перед переходом показываем все оставшиеся бомбы для этого раунда
    showAllBombs = true;
    renderGrid();
    // После небольшой задержки возвращаемся к экрану ставок
    setTimeout(() => {
      gameState = 'selecting';
      currentLevel = 0;
      currentWinnings = 0;
      towerData = [];
      showAllBombs = false;
      stakePanel.style.display = 'flex';
      gamePanel.style.display = 'none';
      gameStatus.textContent = '';
      playBtn.style.display = 'block';
      collectBtn.style.display = 'none';
      continueBtn.style.display = 'none';
    }, 1200);
  });

  function startGame(stake) {
    currentBet = stake;
    currentLevel = 0;
    currentWinnings = 0;
    gameState = 'playing';

     setBalance(getBalance() - stake);
     if(window.mcStats) mcStats.addBet(Math.abs(stake), 'Tower', `${bombCount} бомб`);
     generateTower();

    stakePanel.style.display = 'none';
    gamePanel.style.display = 'flex';

    winningsAmount.textContent = '0.00$';
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
    showAllBombs = false; // Сброс флага при новой игре

    stakePanel.style.display = 'flex';
    gamePanel.style.display = 'none';
    gameStatus.textContent = '';
    playBtn.style.display = 'block';
    collectBtn.style.display = 'none';
    continueBtn.style.display = 'none';
  }

  function openCell(levelIndex, cellCol) {
    if(gameState !== 'playing') return;
    
    const cell = towerData[levelIndex][cellCol];
    cell.opened = true;
    
     if(cell.isBomb) {
       gameStatus.textContent = '✗ Вы попали на бомбу!';
       if(window.mcStats) mcStats.addLoss(Math.abs(currentBet), 'Tower', `Уровень ${levelIndex + 1}, ${bombCount} бомб`);
       gameStatus.className = 'game-status error';
      gameState = 'result';
      showAllBombs = true; // Сразу показываем остальные бомбы
      continueBtn.style.display = 'none'; // Скрываем кнопку ПРОДОЛЖИТЬ
      collectBtn.style.display = 'none';
      addToHistory({ level: levelIndex + 1, win: false, bombs: bombCount, winnings: 0 });
      renderGrid();
      // Автоматически возвращаемся на экран ставок через 1.2 сек
      setTimeout(() => {
        gameState = 'selecting';
        currentLevel = 0;
        currentWinnings = 0;
        towerData = [];
        showAllBombs = false;
        stakePanel.style.display = 'flex';
        gamePanel.style.display = 'none';
        gameStatus.textContent = '';
        playBtn.style.display = '';
        collectBtn.style.display = 'none';
        continueBtn.style.display = 'none';
      }, 1200);
    } else {
      if(levelIndex < TOTAL_LEVELS - 1) {
        currentLevel++;
        currentWinnings = currentBet * COEFS[bombCount][currentLevel - 1] * (1 - HOUSE_EDGE);
        winningsAmount.textContent = currentWinnings.toFixed(2) + '$';
        gameStatus.textContent = `✓ Открыт уровень ${currentLevel + 1}`;
        gameStatus.className = 'game-status success';
        
        // После первой клетки показываем кнопку кэш-аута
        if(currentLevel >= 1) {
          collectBtn.style.display = 'block';
          collectBtn.textContent = `ЗАБРАТЬ $${currentWinnings.toFixed(2)}`;
        }
        
        renderGrid();
      } else {
        currentWinnings = currentBet * COEFS[bombCount][TOTAL_LEVELS - 1] * (1 - HOUSE_EDGE);
        winningsAmount.textContent = currentWinnings.toFixed(2) + '$';
        gameStatus.textContent = '✓ Вы прошли башню!';
        gameStatus.className = 'game-status success';
        gameState = 'result';
        collectBtn.style.display = 'block';
        collectBtn.textContent = `ЗАБРАТЬ $${currentWinnings.toFixed(2)}`;
        continueBtn.style.display = 'none';
        addToHistory({ level: TOTAL_LEVELS, win: true, bombs: bombCount, winnings: currentWinnings });
        renderGrid();
      }
    }
  }

  function addToHistory(record) {
    gameHistory.unshift(record);
    if(gameHistory.length > 10) gameHistory.pop();
    updateHistoryDisplay();
  }

  function updateHistoryDisplay() {
    historyScroll.innerHTML = '';
    gameHistory.forEach(record => {
      const item = document.createElement('div');
      item.className = 'history-item' + (record.win ? '' : ' loss');
      item.innerHTML = `
        <div class="history-item-text">${record.bombs}💣 Lvl ${record.level}</div>
        <div class="history-item-value">${record.win ? '+' : '−'}$${record.winnings.toFixed(2)}</div>
      `;
      historyScroll.appendChild(item);
    });
  }

  // Initialize
  updateBombDisplay();
  updateCoefsDisplay();
  document.querySelectorAll('.balance-value').forEach(el => {
    el.textContent = getBalance().toFixed(2);
  });
});
