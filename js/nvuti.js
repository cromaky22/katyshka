document.addEventListener('DOMContentLoaded', function(){
  const probabilitySlider = document.getElementById('probabilitySlider');
  const probabilityValue = document.getElementById('probabilityValue');
  const coefficientValue = document.getElementById('coefficientValue');
  const stakeInput = document.getElementById('stakeInput');
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const lessBtn = document.getElementById('lessBtn');
  const moreBtn = document.getElementById('moreBtn');
  const playBtn = document.getElementById('playBtn');
  const continueBtn = document.getElementById('continueBtn');
  const stakePanel = document.getElementById('stakePanel');
  const resultPanel = document.getElementById('resultPanel');
  const resultNumber = document.getElementById('resultNumber');
  const resultRange = document.getElementById('resultRange');
  const gameStatus = document.getElementById('gameStatus');
  const historyScroll = document.getElementById('historyScroll');
  const lessRange = document.getElementById('lessRange');
  const moreRange = document.getElementById('moreRange');

  let selectedType = 0; // 0 = less (меньше), 1 = more (больше)
  let gameActive = false;
  let currentGameData = null;

  // Balance helpers
  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  // Utility functions
  function round(t, a) {
    return parseFloat(parseFloat(t).toFixed(a));
  }

  function numberFormat(num, withSpaces = true) {
    if (!withSpaces) return num.toString();
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  // Update coefficient and ranges based on probability
  function updateCoefficient() {
    const v = parseInt(probabilitySlider.value);
    const coef = round((100 / v) * 0.95, 2);
    
    probabilityValue.textContent = `${v}%`;
    coefficientValue.textContent = `x${coef.toFixed(2)}`;
    
    // Calculate ranges according to server logic
    const lessMax = 9999 + v * 10000 - 10000;
    const moreMin = 990000 - v * 10000 + 10000;
    
    lessRange.textContent = `1 - ${numberFormat(lessMax)}`;
    moreRange.textContent = `${numberFormat(moreMin)} - 999 999`;
  }

  // Event listeners
  probabilitySlider.addEventListener('change', updateCoefficient);
  probabilitySlider.addEventListener('input', updateCoefficient);

  // Quick bet buttons
  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      const currentValue = parseFloat(stakeInput.value) || 0;
      const newValue = currentValue + amount;
      stakeInput.value = Math.min(1000000, newValue).toFixed(2);
    });
  });

  // Stake helpers
  halfBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.max(0.2, (val / 2).toFixed(2));
  });

  doubleBtn.addEventListener('click', () => {
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.min(1000000, (val * 2).toFixed(2));
  });

  // Range selection
  lessBtn.addEventListener('click', () => {
    selectedType = 0;
    lessBtn.classList.add('active');
    moreBtn.classList.remove('active');
  });

  moreBtn.addEventListener('click', () => {
    selectedType = 1;
    moreBtn.classList.add('active');
    lessBtn.classList.remove('active');
  });

  // Play button
  playBtn.addEventListener('click', () => {
    if(gameActive) return;

    const stake = parseFloat(stakeInput.value);
    if(isNaN(stake) || stake <= 0){
      gameStatus.textContent = 'Введите корректную ставку';
      gameStatus.className = 'game-status error';
      return;
    }

    // Minimum bet
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

  // Continue button
  continueBtn.addEventListener('click', () => {
    resultPanel.style.display = 'none';
    stakePanel.style.display = 'block';
    gameActive = false;
    gameStatus.textContent = '';
    currentGameData = null;
    updateCoefficient();
  });

  function startGame(bet) {
    gameActive = true;
    playBtn.disabled = true;
    
    const v = parseInt(probabilitySlider.value);
    const t = selectedType;
    
     // Deduct stake
     setBalance(getBalance() - bet);
     if(window.mcStats) mcStats.addBet(Math.abs(bet), 'Nvuti', `${selectedType === 0 ? 'Меньше' : 'Больше'} ${v}%`);
    
    // Hide stake panel, show result panel
    stakePanel.style.display = 'none';
    resultPanel.style.display = 'block';
    
    // Generate random number between 1 and 999999 (server logic)
    const number = Math.floor(Math.random() * 999999) + 1;
    
    // Calculate win according to server logic
    let win = false;
    
    if(t === 0) { // "Меньше"
      if(number >= 1 && number <= 9999 + v * 10000 - 10000) {
        win = true;
      }
    } else { // "Больше"
      if(number >= 990000 - v * 10000 + 10000 && number <= 999999) {
        win = true;
      }
    }
    
    // Calculate coefficient and winnings
    const coef = round((100 / v) * 0.95, 2);
    const winAmount = Math.round(bet * coef * 100) / 100;
    
    // Store game data
    currentGameData = {
      number: number,
      v: v,
      t: t,
      bet: bet,
      win: win ? winAmount : 0,
      coef: coef
    };
    
     // Add to balance if win
     if(win) {
       setBalance(getBalance() + winAmount);
       if(window.mcStats) mcStats.addWin(winAmount, 'Nvuti', `${selectedType === 0 ? 'Меньше' : 'Больше'} ${v}%, число ${number}`);
     } else {
       if(window.mcStats) mcStats.addLoss(Math.abs(bet), 'Nvuti', `${selectedType === 0 ? 'Меньше' : 'Больше'} ${v}%, число ${number}`);
     }
    
    // Show result with rolling animation
    animateResultNumber(number, () => {
      const rangeText = t === 0 
        ? `1 - ${numberFormat(9999 + v * 10000 - 10000)}`
        : `${numberFormat(990000 - v * 10000 + 10000)} - 999 999`;
      resultRange.textContent = `Диапазон: ${rangeText}`;
      
      // Animate result after delay
      setTimeout(() => {
        if(win){
          gameStatus.textContent = `✓ Выигрыш: $${winAmount.toFixed(2)} (x${coef.toFixed(2)})`;
          gameStatus.className = 'game-status success';
          addToHistory({ win: true, v: v });
        } else {
          gameStatus.textContent = `✗ Проигрыш: -$${bet}`;
          gameStatus.className = 'game-status error';
          addToHistory({ win: false, v: v });
        }
        
        playBtn.disabled = false;
      }, 300);
    });
  }

  // Animate number rolling effect
  function animateResultNumber(finalNumber, onComplete) {
    const duration = 1200; // 1.2 секунды для анимации
    const frames = 40; // количество обновлений
    const startTime = Date.now();
    
    resultNumber.style.transition = 'none';
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if(progress < 1) {
        // Показываем случайное число во время анимации
        const randomNum = Math.floor(Math.random() * (finalNumber + 1));
        resultNumber.textContent = numberFormat(randomNum);
        
        // Добавляем класс анимации для каждого обновления
        resultNumber.classList.remove('rolling');
        void resultNumber.offsetWidth; // reflow trigger
        resultNumber.classList.add('rolling');
        
        // Эффект прозрачности - мерцание при быстром перелистывании
        resultNumber.style.opacity = (0.7 + Math.random() * 0.3).toString();
      } else {
        // Финальный результат
        resultNumber.textContent = numberFormat(finalNumber);
        resultNumber.style.opacity = '1';
        resultNumber.classList.remove('rolling');
        resultNumber.style.transform = 'scale(1)';
        clearInterval(interval);
        if(onComplete) onComplete();
      }
    }, duration / frames);
  }

  function addToHistory(result) {
    const item = document.createElement('div');
    item.className = `history-item ${result.win ? 'win' : 'lose'}`;
    
    // Show probability on item
    item.textContent = result.v + '%';
    item.title = result.win ? 'Выигрыш' : 'Проигрыш';
    
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

  // Initialize
  updateCoefficient();
});
