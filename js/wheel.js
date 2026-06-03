(function() {
  'use strict';

  // DOM элементы
  const headerBalance = document.getElementById('headerBalance');
  const gameBalance = document.getElementById('gameBalance');
  const historyScroll = document.getElementById('historyScroll');
  const wheelImage = document.getElementById('wheelImage');
  const wheelWrapper = document.getElementById('wheelWrapper');
  const ballWrapper = document.getElementById('ballWrapper');
  const ballContainer = document.getElementById('ballContainer');
  const wheelWaiting = document.getElementById('wheelWaiting');
  const bettingTable = document.getElementById('bettingTable');
  const numbersTable = document.getElementById('numbersTable');
  const numbersGrid = document.getElementById('numbersGrid');
  const stakeInput = document.getElementById('stakeInput');
  const gameStatus = document.getElementById('gameStatus');
  const toggleNumbersBtn = document.getElementById('toggleNumbersBtn');
  const toggleDefaultBtn = document.getElementById('toggleDefaultBtn');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const playerBetDisplay = document.getElementById('playerBet');

  // Константы
  const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const MIN_STAKE = 0.5;
  const MAX_STAKE = 200;
  const HISTORY_LIMIT = 15;

  // Состояние игры
  let gameState = {
    balance: 100,
    history: [],
    currentBet: null,
    isSpinning: false,
    selectedNumbers: new Set(),
    wheelRotation: 0,
    autoStartTimer: null,
    autoStartCountdown: 0
  };

  // Инициализация
  function init() {
    loadBalance();
    createNumbersGrid();
    attachEventListeners();
    updateDisplay();
  }

  // Управление балансом
  function getBalance() {
    const saved = localStorage.getItem('mc_balance');
    return parseFloat(saved) || 100;
  }

  function setBalance(amount) {
    gameState.balance = Math.max(0, parseFloat(amount).toFixed(2));
    localStorage.setItem('mc_balance', gameState.balance);
    updateDisplay();
  }

  function loadBalance() {
    gameState.balance = getBalance();
  }

  // Обновление дисплея
  function updateDisplay() {
    const formatted = gameState.balance.toFixed(2);
    headerBalance.textContent = formatted;
    gameBalance.textContent = formatted;
  }

  // Создание сетки чисел
  function createNumbersGrid() {
    numbersGrid.innerHTML = '';
    for (let i = 0; i <= 36; i++) {
      const btn = document.createElement('button');
      btn.className = 'bet-btn';
      btn.dataset.bet = i;
      btn.textContent = i;
      btn.innerHTML = `${i}<div class="coef">x36</div>`;
      btn.addEventListener('click', () => placeBet(i.toString()));
      numbersGrid.appendChild(btn);
    }
  }

  // Прикрепление слушателей событий
  function attachEventListeners() {
    // Быстрые кнопки ставок
    document.querySelectorAll('.quick-bet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = parseFloat(btn.dataset.amount);
        changeStake(amount);
      });
    });

    // Таблица ставок - ставят сразу при клике
    document.querySelectorAll('.betting-table .bet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (gameState.isSpinning) return;
        const betType = btn.dataset.bet;
        placeBetAndSpin(betType);
      });
    });

    // Кнопки числа - ставят сразу при клике
    document.querySelectorAll('.numbers-grid .bet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (gameState.isSpinning) return;
        const betType = btn.dataset.bet;
        placeBetAndSpin(betType);
      });
    });

    // Управление ставкой
    stakeInput.addEventListener('change', (e) => {
      let value = parseFloat(e.target.value);
      value = Math.max(MIN_STAKE, Math.min(MAX_STAKE, value));
      stakeInput.value = value.toFixed(2);
    });

    halfBtn.addEventListener('click', () => {
      let newStake = parseFloat(stakeInput.value) / 2;
      newStake = Math.max(MIN_STAKE, Math.min(MAX_STAKE, newStake));
      stakeInput.value = newStake.toFixed(2);
    });
    
    doubleBtn.addEventListener('click', () => {
      let newStake = parseFloat(stakeInput.value) * 2;
      newStake = Math.max(MIN_STAKE, Math.min(MAX_STAKE, newStake));
      stakeInput.value = newStake.toFixed(2);
    });

    // Кнопки переключения таблиц
    toggleNumbersBtn.addEventListener('click', () => {
      bettingTable.classList.add('hidden');
      numbersTable.classList.remove('hidden');
    });

    toggleDefaultBtn.addEventListener('click', () => {
      numbersTable.classList.add('hidden');
      bettingTable.classList.remove('hidden');
    });

    toggleDefaultBtn.addEventListener('click', () => {
      numbersTable.classList.add('hidden');
      bettingTable.classList.remove('hidden');
    });

    // Кнопка ЗАБРАТЬ
    collectBtn.addEventListener('click', () => collectWin());
  }

  // Размещение ставки и запуск таймера автоматического старта
  function placeBetAndSpin(betType) {
    const stake = parseFloat(stakeInput.value);

    // Проверка достаточности средств
    if (stake > gameState.balance) {
      showStatus('Недостаточно средств!', 'error');
      return;
    }

    // Если уже есть активная ставка, отмена
    if (gameState.currentBet && gameState.autoStartTimer) {
      return;
    }

    // Установить текущую ставку
    gameState.currentBet = {
      type: betType,
      amount: stake,
      result: null,
      winAmount: null
    };

    // Обновить дисплей информации игрока
    updatePlayerBetDisplay();

    // Запустить таймер на 30 секунд до автоматического старта
    startAutoStartTimer();
  }

  // Запуск таймера автоматического старта (30 секунд)
  function startAutoStartTimer() {
    // Если таймер уже работает, отменить его и начать заново
    if (gameState.autoStartTimer) {
      clearInterval(gameState.autoStartTimer);
    }

    gameState.autoStartCountdown = 30;
    const countdownTimer = document.getElementById('countdownTimer');
    
    // Показать таймер
    wheelWaiting.style.display = 'flex';
    if (countdownTimer) {
      countdownTimer.textContent = gameState.autoStartCountdown;
    }

    gameState.autoStartTimer = setInterval(() => {
      gameState.autoStartCountdown--;

      if (gameState.autoStartCountdown > 0) {
        if (countdownTimer) {
          countdownTimer.textContent = gameState.autoStartCountdown;
        }
      } else {
        // Время истекло, запустить игру
        clearInterval(gameState.autoStartTimer);
        gameState.autoStartTimer = null;
        if (countdownTimer) {
          countdownTimer.textContent = '';
        }
        startGame();
      }
    }, 1000);
  }

  // Отмена таймера автоматического старта
  function cancelAutoStartTimer() {
    if (gameState.autoStartTimer) {
      clearInterval(gameState.autoStartTimer);
      gameState.autoStartTimer = null;
      gameState.autoStartCountdown = 0;
    }
  }

  // Обновление информации о текущей ставке
  function updatePlayerBetDisplay() {
    if (gameState.currentBet) {
      playerBetDisplay.textContent = `Ставка: $${gameState.currentBet.amount.toFixed(2)} на ${getBetLabel(gameState.currentBet.type)}`;
    } else {
      playerBetDisplay.textContent = 'Ставка: нет';
    }
  }

  // Получить название ставки
  function getBetLabel(betType) {
    const labels = {
      'red': 'Красное',
      'black': 'Черное',
      'odd': 'Четное',
      'notodd': 'Нечетное',
      'range1': '1-18',
      '0': '0',
      'range2': '19-36',
      'range3': '1-12',
      'range4': '13-24',
      'range5': '25-36'
    };
    return labels[betType] || `Число ${betType}`;
  }

  // Изменение ставки
  function changeStake(amount) {
    let newStake = parseFloat(stakeInput.value) + parseFloat(amount);
    newStake = Math.max(MIN_STAKE, Math.min(MAX_STAKE, newStake));
    stakeInput.value = newStake.toFixed(2);
  }

  // Начать игру
  function startGame() {
    if (!gameState.currentBet) {
      showStatus('Выберите ставку', 'error');
      return;
    }

    // Отменить таймер автоматического старта если он еще работает
    cancelAutoStartTimer();

    const stake = gameState.currentBet.amount;
    if (stake > gameState.balance) {
      showStatus('Недостаточно средств!', 'error');
      return;
    }

    // Отключить кнопки ставок
    gameState.isSpinning = true;
    document.querySelectorAll('.betting-table .bet-btn, .numbers-grid .bet-btn').forEach(btn => {
      btn.disabled = true;
    });
    collectBtn.classList.add('hidden');
    wheelWaiting.style.display = 'none';

    // Отчислить ставку
    setBalance(gameState.balance - stake);
    showStatus('🎡 Вращение колеса...', '');

    // Генерировать результат
    const resultNumber = Math.floor(Math.random() * 37);

    // Запустить анимацию спина
    spinWheel(resultNumber, () => {
      // Определить выигрыш
      const won = checkWin(resultNumber, gameState.currentBet.type);
      const winAmount = won ? getWinMultiplier(gameState.currentBet.type) * stake : 0;

      gameState.currentBet.result = resultNumber;
      gameState.currentBet.winAmount = winAmount;

      // Обновить историю
      addToHistory(resultNumber);

      // Показать статус
      if (won) {
        setBalance(gameState.balance + winAmount);
        showStatus(`✅ Выигрыш! +$${winAmount.toFixed(2)}`, 'success');
        collectBtn.classList.remove('hidden');
        // Кнопки ставок остаются отключены до нажатия ЗАБРАТЬ
      } else {
        showStatus(`❌ Проиграно ставку $${stake.toFixed(2)}`, 'error');
        gameState.currentBet = null;
        updatePlayerBetDisplay();
        // Включить кнопки ставок для следующего раунда
        document.querySelectorAll('.betting-table .bet-btn, .numbers-grid .bet-btn').forEach(btn => {
          btn.disabled = false;
        });
        wheelWaiting.style.display = 'flex';
        // Очистить таймер
        const countdownTimer = document.getElementById('countdownTimer');
        if (countdownTimer) {
          countdownTimer.textContent = '';
        }
      }

      // Разблокировать
      gameState.isSpinning = false;
    });
  }

  // Проверка выигрыша
  function checkWin(resultNumber, betType) {
    if (betType === '0') return resultNumber === 0;
    if (betType === 'red') return RED_NUMBERS.includes(resultNumber);
    if (betType === 'black') return !RED_NUMBERS.includes(resultNumber) && resultNumber !== 0;
    if (betType === 'odd') return resultNumber % 2 === 0 && resultNumber !== 0;
    if (betType === 'notodd') return resultNumber % 2 === 1;
    if (betType === 'range1') return resultNumber >= 1 && resultNumber <= 18;
    if (betType === 'range2') return resultNumber >= 19 && resultNumber <= 36;
    if (betType === 'range3') return resultNumber >= 1 && resultNumber <= 12;
    if (betType === 'range4') return resultNumber >= 13 && resultNumber <= 24;
    if (betType === 'range5') return resultNumber >= 25 && resultNumber <= 36;
    return parseInt(betType) === resultNumber;
  }

  // Получить множитель выигрыша (с house edge 6%)
  const WHEEL_HOUSE_EDGE = 0.06;
  function getWinMultiplier(betType) {
    const base = (betType === '0') ? 36 : (betType.match(/^\d+$/) && betType !== '0') ? 36 : (betType === 'range3' || betType === 'range4' || betType === 'range5') ? 3 : 2;
    return +((base * (1 - WHEEL_HOUSE_EDGE)).toFixed(2));
  }

  // Спин колеса с шариком
  function spinWheel(resultNumber, onComplete) {
    // Градусы для каждого числа (360 / 37)
    const degreesPerNumber = 360 / 37;
    const targetDegrees = resultNumber * degreesPerNumber;
    const randomOffset = (Math.random() - 0.5) * degreesPerNumber * 0.8;
    
    // Финальный угол для колеса (10 полных оборотов)
    const wheelFinalRotation = 360 * 10 + targetDegrees + randomOffset;
    
    // Добавляем стили анимации
    const style = document.createElement('style');
    const timestamp = Date.now();
    const wheelAnimName = `wheel-spin-${timestamp}`;
    const ballSettleAnimName = `ball-settle-${timestamp}`;
    
    style.textContent = `
      @keyframes ${wheelAnimName} {
        from { transform: translate(-50%, -50%) rotateZ(0deg); }
        to { transform: translate(-50%, -50%) rotateZ(${wheelFinalRotation}deg); }
      }
      @keyframes ${ballSettleAnimName} {
        0% { opacity: 1; transform: translateX(-50%) scale(1); }
        90% { opacity: 1; transform: translateX(-50%) scale(1); }
        100% { opacity: 1; transform: translateX(-50%) scale(0.8) translateY(2px); }
      }
    `;
    document.head.appendChild(style);
    
    // Запускаем анимацию колеса - оно вращается на месте
    wheelWrapper.style.animation = `${wheelAnimName} 10s ease-out forwards`;
    
    // Шарик вращается вместе с колесом
    ballWrapper.style.animation = `${wheelAnimName} 10s ease-out forwards`;
    
    // Шарик закатывается в конечное число
    ballContainer.style.animation = `${ballSettleAnimName} 10s ease-out forwards`;
    ballContainer.style.opacity = '1';

    setTimeout(() => {
      onComplete();
    }, 11000);
  }

  // Добавить в историю
  function addToHistory(resultNumber) {
    const color = getNumberColor(resultNumber);
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.background = color;
    item.style.color = '#fff';
    item.textContent = resultNumber;
    historyScroll.insertBefore(item, historyScroll.firstChild);

    while (historyScroll.children.length > HISTORY_LIMIT) {
      historyScroll.removeChild(historyScroll.lastChild);
    }

    gameState.history.push({
      number: resultNumber,
      color: color,
      timestamp: new Date()
    });
  }

  // Получить цвет числа
  function getNumberColor(num) {
    if (num === 0) return '#8bc34a';
    if (RED_NUMBERS.includes(num)) return '#f44336';
    return '#2c3e50';
  }

  // Показать статус
  function showStatus(message, type) {
    gameStatus.textContent = message;
    gameStatus.className = 'game-status';
    if (type) gameStatus.classList.add(type);
  }

  // Собрать выигрыш
  function collectWin() {
    // Отменить таймер автоматического старта если он еще работает
    cancelAutoStartTimer();
    
    collectBtn.classList.add('hidden');
    gameState.currentBet = null;
    updatePlayerBetDisplay();
    showStatus('', '');
    
    // Включить обратно кнопки ставок
    document.querySelectorAll('.betting-table .bet-btn, .numbers-grid .bet-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
    });
    
    gameState.isSpinning = false;
    wheelWaiting.style.display = 'flex';
    
    // Сброс анимации колеса
    wheelWrapper.style.animation = 'none';
    wheelWrapper.style.transform = 'translate(-50%, -50%) rotateZ(0deg)';
    ballWrapper.style.animation = 'none';
    ballWrapper.style.transform = 'none';
    ballContainer.style.animation = 'none';
    ballContainer.style.opacity = '1';
    ballContainer.style.transform = 'translateX(-50%)';
    
    // Очистить таймер
    const countdownTimer = document.getElementById('countdownTimer');
    if (countdownTimer) {
      countdownTimer.textContent = '';
    }
  }

  // Инициализировать при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
