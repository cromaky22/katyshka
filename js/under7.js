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
  const numberDisplay = document.getElementById('numberDisplay');

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

  // Rotation to show each face (1-6) looking at camera
  // f1=front, f6=back, f2=right, f5=left, f3=top, f4=bottom
  const rotations = {
    1: { rx: 0, ry: 0 },
    2: { rx: 0, ry: -90 },
    3: { rx: -90, ry: 0 },
    4: { rx: 90, ry: 0 },
    5: { rx: 0, ry: 90 },
    6: { rx: 0, ry: 180 }
  };

  function setDice(diceEl, value){
    const r = rotations[value];
    // Add independent random spins for realistic rolling
    const spinsX = 360 * (3 + Math.floor(Math.random() * 3));
    const spinsY = 360 * (3 + Math.floor(Math.random() * 3));
    const finalRx = r.rx + spinsX;
    const finalRy = r.ry + spinsY;
    diceEl.style.transform = 'rotateX(' + finalRx + 'deg) rotateY(' + finalRy + 'deg)';
  }

  function rollDice(){
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;

    dice1.classList.add('rolling');
    dice2.classList.add('rolling');

    return new Promise(resolve => {
      setTimeout(()=>{
        dice1.classList.remove('rolling');
        dice2.classList.remove('rolling');
        setDice(dice1, d1);
        setDice(dice2, d2);
        // Update display with actual result
        if(numberDisplay) numberDisplay.textContent = sum;
        console.log('Dice result: ' + d1 + ' + ' + d2 + ' = ' + sum);
        resolve({ d1, d2, sum });
      }, 1200);
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
    if(numberDisplay) numberDisplay.textContent = '?';

    const { sum } = await rollDice();

    let win = false;
    let multiplier = 0;
    if(choice === 'under'){ win = sum < 7; multiplier = 2.3; }
    else if(choice === 'over'){ win = sum > 7; multiplier = 2.3; }
    else if(choice === 'exact'){ win = sum === 7; multiplier = 5.8; }

    // Determine history color by result
    let historyClass;
    if(sum === 7) historyClass = 'exact';
    else if(sum < 7) historyClass = 'under';
    else historyClass = 'over';

    if(win){
      const winAmount = stake * multiplier;
      setBalance(getBalance() + winAmount);
      resultMessage.textContent = 'Выигрыш! +$' + winAmount.toFixed(2);
      resultMessage.className = 'result-message win';
      addToHistory(winAmount, historyClass, sum);
    } else {
      resultMessage.textContent = 'Проигрыш';
      resultMessage.className = 'result-message lose';
      addToHistory(0, historyClass, sum);
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
    if(lastStake > 0 && lastChoice){
      stakeInput.value = lastStake.toFixed(2);
      play(lastChoice);
    } else if(lastStake > 0){
      stakeInput.value = lastStake.toFixed(2);
    }
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); if(!isRolling) play(lastChoice || 'under'); }
  });
});