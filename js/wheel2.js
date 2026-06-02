(function() {
  'use strict';

  // DOM элементы
  const headerBalance = document.getElementById('headerBalance');
  const gameBalance = document.getElementById('gameBalance');
  const historyScroll = document.getElementById('historyScroll');
  const wheelDisplay = document.getElementById('wheelDisplay');
  const bettingTable = document.getElementById('bettingTable');
  const numbersTable = document.getElementById('numbersTable');
  const numbersGrid = document.getElementById('numbersGrid');
  const stakeInput = document.getElementById('stakeInput');
  const playBtn = document.getElementById('playBtn');
  const collectBtn = document.getElementById('collectBtn');
  const gameStatus = document.getElementById('gameStatus');
  const toggleNumbersBtn = document.getElementById('toggleNumbersBtn');
  const toggleDefaultBtn = document.getElementById('toggleDefaultBtn');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');

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
    selectedNumbers: new Set()
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
    const saved = localStorage.getItem('mc_balance_wheel2');
    return parseFloat(saved) || 100;
  }

  function setBalance(amount) {
    gameState.balance = Math.max(0, parseFloat(amount).toFixed(2));
    localStorage.setItem('mc_balance_wheel2', gameState.balance);
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

    // Таблица ставок
    document.querySelectorAll('.betting-table .bet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const betType = btn.dataset.bet;
        placeBet(betType);
      });
    });

    // Управление ставкой
    stakeInput.addEventListener('change', (e) => {
      let value = parseFloat(e.target.value);
      value = Math.max(MIN_STAKE, Math.min(MAX_STAKE, value));
      stakeInput.value = value.toFixed(2);
    });

    halfBtn.addEventListener('click', () => changeStake(stakeInput.value / 2));
    doubleBtn.addEventListener('click', () => changeStake(stakeInput.value * 2));

    // Кнопки переключения таблиц
    toggleNumbersBtn.addEventListener('click', () => {
      bettingTable.classList.add('hidden');
      numbersTable.classList.remove('hidden');
    });

    toggleDefaultBtn.addEventListener('click', () => {
      numbersTable.classList.add('hidden');
      bettingTable.classList.remove('hidden');
    });

    // Кнопка СТАВИТЬ
    playBtn.addEventListener('click', () => startGame());

    // Кнопка ЗАБРАТЬ
    collectBtn.addEventListener('click', () => collectWin());
  }

  // Размещение ставки
  function placeBet(betType) {
    const stake = parseFloat(stakeInput.value);

    // Проверка достаточности средств
    if (stake > gameState.balance) {
      showStatus('Недостаточно средств!', 'error');
      return;
    }

    gameState.currentBet = {
      type: betType,
      amount: stake,
      result: null,
      winAmount: null
    };

    // Визуально отметить выбранную ставку
    document.querySelectorAll('[data-bet]').forEach(btn => {
      btn.style.opacity = (btn.dataset.bet === betType) ? '1' : '0.6';
    });

    showStatus(`Ставка $${stake.toFixed(2)} на ${getBetLabel(betType)}`, '');
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

    const stake = gameState.currentBet.amount;
    if (stake > gameState.balance) {
      showStatus('Недостаточно средств!', 'error');
      return;
    }

    // Отключить кнопку и показать спиннинг
    gameState.isSpinning = true;
    playBtn.disabled = true;
    collectBtn.classList.add('hidden');

    // Отчислить ставку
    setBalance(gameState.balance - stake);
    showStatus('🎡 Вращение...', '');

    // Генерировать результат
    const resultNumber = Math.floor(Math.random() * 37);

    // Запустить анимацию спина
    spinWheel(resultNumber, () => {
      // Определить выигрыш
      const won = checkWin(resultNumber, gameState.currentBet.type);
      const winAmount = won ? getWinMultiplier(gameState.currentBet.type) * stake : 0;

      gameState.currentBet.result = resultNumber;
      gameState.currentBet.winAmount = winAmount;

      // Показать результат
      showResult(resultNumber);

      // Обновить историю
      addToHistory(resultNumber);

      // Показать статус
      if (won) {
        setBalance(gameState.balance + winAmount);
        showStatus(`✅ Выигрыш! +$${winAmount.toFixed(2)}`, 'success');
        collectBtn.classList.remove('hidden');
      } else {
        showStatus(`❌ Проиграно ставку $${stake.toFixed(2)}`, 'error');
      }

      // Разблокировать
      gameState.isSpinning = false;
      playBtn.disabled = false;
      gameState.currentBet = null;
      document.querySelectorAll('[data-bet]').forEach(btn => btn.style.opacity = '1');
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
    // Число
    return parseInt(betType) === resultNumber;
  }

  // Получить множитель выигрыша
  function getWinMultiplier(betType) {
    if (betType === '0') return 36;
    if (betType.match(/\d+/) && betType !== '0') return 36;
    return 2; // Все остальные ставки x2 или x3
  }

  // Спин колеса
  function spinWheel(resultNumber, onComplete) {
    // Угол для каждого числа (360 / 37)
    const degreesPerNumber = 360 / 37;
    const resultAngle = resultNumber * degreesPerNumber;
    const segmentHalf = degreesPerNumber / 2;
    const randomOffset = (Math.random() - 0.5) * segmentHalf;
    const targetDeg = resultAngle + randomOffset;
    const targetRotation = 360 * 10 + targetDeg;

    wheelDisplay.innerHTML = `
      <style>
        @keyframes spin {
          from { transform: rotateZ(0deg); }
          to { transform: rotateZ(${targetRotation}deg); }
        }
        .wheel-spinner {
          position: relative;
          width: 200px;
          height: 200px;
        }
        .wheel-img {
          width: 100%;
          height: 100%;
          animation: spin 10s ease-out forwards;
          filter: drop-shadow(0 8px 16px rgba(26, 188, 156, 0.3));
        }
        .pointer {
          position: absolute;
          top: -15px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 32px;
          color: #1abc9c;
          z-index: 10;
        }
      </style>
      <div class="wheel-spinner">
        <div class="pointer">▼</div>
        <img class="wheel-img" src="assets/wheel.svg" alt="Wheel">
      </div>
    `;

    setTimeout(onComplete, 10000);
  }

  // Показать результат
  function showResult(resultNumber) {
    const color = getNumberColor(resultNumber);
    const bgColor = resultNumber === 0 ? '#8bc34a' : RED_NUMBERS.includes(resultNumber) ? '#f44336' : '#2c3e50';
    const textColor = resultNumber === 0 ? '#000' : '#fff';

    wheelDisplay.innerHTML = `
      <style>
        @keyframes scaleResult {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .result-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: ${bgColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: 700;
          color: ${textColor};
          animation: scaleResult 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
      </style>
      <div class="result-circle">${resultNumber}</div>
    `;
  }

  // Получить цвет числа
  function getNumberColor(num) {
    if (num === 0) return '#8bc34a';
    if (RED_NUMBERS.includes(num)) return '#f44336';
    return '#2c3e50';
  }

  // Добавить в историю
  function addToHistory(resultNumber) {
    const color = getNumberColor(resultNumber);
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.background = color;
    item.style.color = (resultNumber === 0 || RED_NUMBERS.includes(resultNumber)) ? '#fff' : '#fff';
    item.textContent = resultNumber;
    historyScroll.insertBefore(item, historyScroll.firstChild);

    // Ограничить историю до HISTORY_LIMIT элементов
    while (historyScroll.children.length > HISTORY_LIMIT) {
      historyScroll.removeChild(historyScroll.lastChild);
    }

    gameState.history.push({
      number: resultNumber,
      color: color,
      timestamp: new Date()
    });
  }

  // Показать статус
  function showStatus(message, type) {
    gameStatus.textContent = message;
    gameStatus.className = 'game-status';
    if (type) gameStatus.classList.add(type);
  }

  // Собрать выигрыш
  function collectWin() {
    collectBtn.classList.add('hidden');
    gameState.currentBet = null;
    showStatus('', '');
    document.querySelectorAll('[data-bet]').forEach(btn => btn.style.opacity = '1');
  }

  // Инициализировать при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
