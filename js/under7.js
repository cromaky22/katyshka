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
  const diceStatus = document.getElementById('diceStatus');

  let lastChoice = null;
  let lastStake = 0;
  let isRolling = false;

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  halfBtn.addEventListener('click', ()=>{
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.max(0.1, val / 2).toFixed(2);
  });

  doubleBtn.addEventListener('click', ()=>{
    const val = parseFloat(stakeInput.value) || 0;
    stakeInput.value = Math.min(200, val * 2).toFixed(2);
  });

  quickBtns.forEach(btn => {
    btn.addEventListener('click', ()=>{
      stakeInput.value = parseFloat(btn.dataset.amount).toFixed(2);
    });
  });

  // Dice layout: front=1, back=6, right=2, left=5, top=3, bottom=4
  // Rotations to show each face on top/front
  const diceRotations = {
    1: { rx: 0, ry: 0 },
    2: { rx: 0, ry: 90 },
    3: { rx: -90, ry: 0 },
    4: { rx: 90, ry: 0 },
    5: { rx: 0, ry: -90 },
    6: { rx: 0, ry: 180 }
  };

  // Initial state - both showing 1
  dice1.style.transform = 'rotateX(0deg) rotateY(0deg)';
  dice2.style.transform = 'rotateX(0deg) rotateY(0deg)';

  function rollDice(){
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;

    const rot1 = diceRotations[d1];
    const rot2 = diceRotations[d2];

    dice1.style.setProperty('--rx', rot1.rx + 'deg');
    dice1.style.setProperty('--ry', rot1.ry + 'deg');
    dice2.style.setProperty('--rx', rot2.rx + 'deg');
    dice2.style.setProperty('--ry', rot2.ry + 'deg');

    dice1.classList.add('rolling');
    dice2.classList.add('rolling');
    diceStatus.textContent = 'Бросаем...';
    diceStatus.style.color = 'var(--accent)';

    return new Promise(resolve => {
      setTimeout(()=>{
        dice1.classList.remove('rolling');
        dice2.classList.remove('rolling');
        dice1.style.transform = 'rotateX(' + rot1.rx + 'deg) rotateY(' + rot1.ry + 'deg)';
        dice2.style.transform = 'rotateX(' + rot2.rx + 'deg) rotateY(' + rot2.ry + 'deg)';
        diceStatus.textContent = d1 + ' + ' + d2 + ' = ' + sum;
        diceStatus.style.color = 'var(--text)';
        resolve({ d1, d2, sum });
      }, 800);
    });
  }

  async function play(choice){
    if(isRolling) return;
    if(!choice){ diceStatus.textContent = 'Выберите ПОД 7, 7 или НАД 7'; diceStatus.style.color = '#ef5350'; return; }
    const stake = parseFloat(stakeInput.value) || 0;
    if(stake <= 0 || stake > getBalance()){ diceStatus.textContent = 'Недостаточно средств'; diceStatus.style.color = '#ef5350'; return; }

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
    if(lastStake > 0){
      stakeInput.value = lastStake.toFixed(2);
    }
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); if(!isRolling) play(lastChoice || 'under'); }
  });
});