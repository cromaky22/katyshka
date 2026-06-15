document.addEventListener('DOMContentLoaded', function(){
  const stakeInput = document.getElementById('stakeInput');
  const btnUnder = document.getElementById('btnUnder');
  const btnOver = document.getElementById('btnOver');
  const btnExact = document.getElementById('btnExact');
  const resultMessage = document.getElementById('resultMessage');
  const historyScroll = document.getElementById('historyScroll');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const quickBtns = document.querySelectorAll('.quick-btn');
  const dice1 = document.getElementById('dice1');
  const dice2 = document.getElementById('dice2');

  let lastChoice = null;
  let lastStake = 0;
  let isRolling = false;

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  halfBtn.addEventListener('click', ()=>{
    let val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.max(0.1, val / 2).toFixed(2);
  });

  doubleBtn.addEventListener('click', ()=>{
    let val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.min(200, val * 2).toFixed(2);
  });

  quickBtns.forEach(btn => {
    btn.addEventListener('click', ()=>{
      stakeInput.value = parseFloat(btn.dataset.amount).toFixed(2);
    });
  });

  // Dot patterns for dice faces 1-6
  // 9 grid positions: 0 1 2 / 3 4 5 / 6 7 8
  // true = dot visible, false = hidden
  const patterns = {
    1: [0,0,0, 0,1,0, 0,0,0],  // center only
    2: [1,0,0, 0,0,0, 0,0,1],  // top-left + bottom-right
    3: [1,0,0, 0,1,0, 0,0,1],  // diagonal
    4: [1,0,1, 0,0,0, 1,0,1],  // 4 corners
    5: [1,0,1, 0,1,0, 1,0,1],  // 4 corners + center
    6: [1,0,1, 1,0,1, 1,0,1]   // 6 dots (3 per column)
  };

  function setDice(diceEl, value){
    const p = patterns[value];
    const dots = diceEl.querySelectorAll('.dot');
    dots.forEach((dot, i) => {
      if(p[i]) dot.classList.remove('h');
      else dot.classList.add('h');
    });
  }

  function rollDice(){
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;

    dice1.classList.add('roll');
    dice2.classList.add('roll');

    // Rapidly change faces during roll
    let steps = 0;
    const interval = setInterval(()=>{
      setDice(dice1, Math.floor(Math.random() * 6) + 1);
      setDice(dice2, Math.floor(Math.random() * 6) + 1);
      steps++;
    }, 70);

    return new Promise(resolve => {
      setTimeout(()=>{
        clearInterval(interval);
        dice1.classList.remove('roll');
        dice2.classList.remove('roll');
        setDice(dice1, d1);
        setDice(dice2, d2);
        resolve({ d1, d2, sum });
      }, 500);
    });
  }

  async function play(choice){
    if(isRolling) return;
    if(!choice){ resultMessage.textContent = 'Выберите ПОД 7, 7 или НАД 7'; resultMessage.className = 'result-message lose'; return; }
    const stake = parseFloat(stakeInput.value) || 0;
    if(stake <= 0 || stake > getBalance()){ resultMessage.textContent = 'Недостаточно средств'; resultMessage.className = 'result-message lose'; return; }

    isRolling = true;
    setBalance(getBalance() - stake);
    lastChoice = choice;
    lastStake = stake;
    resultMessage.textContent = '';
    resultMessage.className = 'result-message';

    const { sum } = await rollDice();

    let win = false;
    let multiplier = 0;
    if(choice === 'under'){ win = sum < 7; multiplier = 2.3; }
    else if(choice === 'over'){ win = sum > 7; multiplier = 2.3; }
    else if(choice === 'exact'){ win = sum === 7; multiplier = 5.8; }

    if(win){
      const winAmount = stake * multiplier;
      setBalance(getBalance() + winAmount);
      resultMessage.textContent = 'Выигрыш! +$' + winAmount.toFixed(2);
      resultMessage.className = 'result-message win';
      addToHistory(winAmount, 'win', sum);
    } else {
      resultMessage.textContent = 'Проигрыш';
      resultMessage.className = 'result-message lose';
      addToHistory(0, 'lose', sum);
    }
    isRolling = false;
  }

  function addToHistory(amount, type, result){
    const item = document.createElement('div');
    item.className = 'history-item ' + type;
    item.textContent = result;
    historyScroll.prepend(item);
    while(historyScroll.children.length > 20) historyScroll.removeChild(historyScroll.lastChild);
  }

  btnUnder.addEventListener('click', ()=>play('under'));
  btnOver.addEventListener('click', ()=>play('over'));
  btnExact.addEventListener('click', ()=>play('exact'));

  repeatBtn.addEventListener('click', ()=>{
    if(lastStake > 0) stakeInput.value = lastStake.toFixed(2);
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); if(!isRolling) play(lastChoice || 'under'); }
  });
});