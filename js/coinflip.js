document.addEventListener('DOMContentLoaded', function(){
  const coin = document.getElementById('coin');
  const btnHead = document.getElementById('btnHead');
  const btnTail = document.getElementById('btnTail');
  const play = document.getElementById('play');
  const resultEl = document.getElementById('result');
  const stakeInput = document.getElementById('stake');
  const scoreRoundsEl = document.getElementById('scoreRounds');
  const scoreMultiplierEl = document.getElementById('scoreMultiplier');
  let choice = null;

  btnHead.addEventListener('click', ()=>{ choice = 'head'; btnHead.classList.add('active'); btnTail.classList.remove('active'); });
  btnTail.addEventListener('click', ()=>{ choice = 'tail'; btnTail.classList.add('active'); btnHead.classList.remove('active'); });

  function randomResult(){ return Math.random() < 0.5 ? 'head' : 'tail'; }

  function showResult(res){
    resultEl.textContent = res === 'head' ? 'Выпал ОРЕЛ' : 'Выпала РЕШКА';
  }

  play.addEventListener('click', ()=>{
    if(!choice){ resultEl.textContent = 'Выберите Орел или Решка'; return }
    resultEl.textContent = '';
    // read stake
    const baseStake = Math.max(0, Number(stakeInput && stakeInput.value) || 0);
    if(baseStake <= 0){ resultEl.textContent = 'Укажите ставку больше 0'; return }
    coin.classList.remove('flip');
    // trigger reflow to restart animation
    void coin.offsetWidth;
    coin.classList.add('flip');
    // after animation determine result
    setTimeout(()=>{
      const r = randomResult();
      // set final face via data attribute
      if(r === 'head'){
        coin.classList.remove('show-tail');
        coin.classList.add('show-head');
      }else{
        coin.classList.remove('show-head');
        coin.classList.add('show-tail');
      }
      showResult(r);
      // chain logic: win => multiply and progress, lose => reset
      const win = (choice === r);
      if(win){
        // mark this multiplier as passed and accumulate winnings
        markPassed(currentMultiplierIdx);
        const mult = multipliersValues[currentMultiplierIdx] || 1;
        accumulated = accumulated > 0 ? accumulated * mult : baseStake * mult;
        currentRound = Math.min(roundsTotal, currentRound + 1);
        // advance to next multiplier (if any)
        if(currentMultiplierIdx < multipliersValues.length - 1) currentMultiplierIdx++;
        highlightCurrent(currentMultiplierIdx);
        updateScoreDisplay();
        resultEl.textContent += ' — Вы выиграли!';
      }else{
        // lost — reset progress
        resultEl.textContent += ' — Проигрыш';
        resetProgress();
      }
    }, 1400);
  });

  // helper to page-wise activate via keyboard
  function setActive(pageIdx){
    if(!multsContainer) return;
    const pages = Math.max(1, Math.ceil(multsContainer.scrollWidth / Math.max(1, multsContainer.clientWidth)));
    const p = Math.max(0, Math.min(pageIdx, pages-1));
    multsContainer.scrollTo({ left: p * multsContainer.clientWidth, behavior: 'smooth' });
    setTimeout(()=>{ updateActiveGroup(); }, 220);
  }

  // --- chain game state ---
  let roundsTotal = 20;
  let currentRound = 0;
  let currentMultiplierIdx = 0; // index into multItems
  let accumulated = 0; // accumulated winnings (money)
  let multipliersValues = [];

  function parseMultipliers(){
    multipliersValues = multItems.map(it=>{
      const v = it.querySelector('.mult-value')?.textContent || it.textContent || '';
      const n = parseFloat((v+'').replace(/[^0-9.,]/g,'').replace(',','.'));
      return isNaN(n) ? 1 : n;
    });
  }

  function resetProgress(){
    currentRound = 0; currentMultiplierIdx = 0; accumulated = 0;
    multItems.forEach(it=>{ it.classList.remove('passed','current'); });
    if(multItems[0]) multItems[0].classList.add('current');
    updateScoreDisplay();
  }

  function updateScoreDisplay(){
    if(scoreRoundsEl) scoreRoundsEl.textContent = `${currentRound} из ${roundsTotal}`;
    if(scoreMultiplierEl) scoreMultiplierEl.textContent = accumulated>0 ? `x${accumulated.toFixed(2)}` : `x${(multipliersValues[currentMultiplierIdx]||0)}`;
  }

  function markPassed(idx){
    if(multItems[idx]) multItems[idx].classList.add('passed');
  }

  function highlightCurrent(idx){
    multItems.forEach((it,i)=>{ it.classList.toggle('current', i === idx); });
  }


  // Multipliers navigation
  const multsContainer = document.getElementById('multipliers');
  const prevBtn = document.querySelector('.mult-prev');
  const nextBtn = document.querySelector('.mult-next');
  let multItems = [];
  let activeIndex = 0;

  function initMults(){
    if(!multsContainer) return;
    multItems = Array.from(multsContainer.querySelectorAll('.mult-item'));
    if(multItems.length === 0) return;
    // make items non-clickable (design requirement)
    multItems.forEach((it)=>{ it.style.pointerEvents = 'none'; it.style.cursor = 'default'; });
    parseMultipliers();
    // mark first as current
    if(multItems[0]) multItems[0].classList.add('current');
    // set initial active group based on current scroll
    updateActiveGroup();
    updateNavButtons();
    window.addEventListener('resize', ()=>{ updateActiveGroup(); updateNavButtons(); });
  }

  // mark visible items in current viewport as active
  function updateActiveGroup(){
    if(!multItems.length || !multsContainer) return;
    const leftBound = multsContainer.scrollLeft - 1;
    const rightBound = multsContainer.scrollLeft + multsContainer.clientWidth + 1;
    multItems.forEach((it, idx)=>{
      const itLeft = it.offsetLeft;
      const itRight = it.offsetLeft + it.offsetWidth;
      const visible = itRight > leftBound && itLeft < rightBound;
      it.classList.toggle('active', !!visible);
    });
    // set activePage based on scroll position
    activeIndex = Math.round(multsContainer.scrollLeft / Math.max(1, multsContainer.clientWidth));
  }

  function updateNavButtons(){
    if(!prevBtn || !nextBtn || !multItems.length || !multsContainer) return;
    prevBtn.disabled = multsContainer.scrollLeft <= 1;
    nextBtn.disabled = (multsContainer.scrollLeft + multsContainer.clientWidth) >= (multsContainer.scrollWidth - 1);
  }

  // page-wise scroll: move by container width
  if(prevBtn) prevBtn.addEventListener('click', ()=>{
    if(!multsContainer) return;
    const newLeft = Math.max(0, multsContainer.scrollLeft - multsContainer.clientWidth);
    multsContainer.scrollTo({ left: newLeft, behavior: 'smooth' });
    updateNavButtons();
  });
  if(nextBtn) nextBtn.addEventListener('click', ()=>{
    if(!multsContainer) return;
    const maxLeft = Math.max(0, multsContainer.scrollWidth - multsContainer.clientWidth);
    const newLeft = Math.min(maxLeft, multsContainer.scrollLeft + multsContainer.clientWidth);
    multsContainer.scrollTo({ left: newLeft, behavior: 'smooth' });
    updateNavButtons();
  });

  // update active group after user scrolls (debounced)
  let scrollTimer = null;
  if(multsContainer){
    multsContainer.addEventListener('scroll', ()=>{
      updateNavButtons();
      if(scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(()=>{
        updateActiveGroup();
      }, 120);
    });
  }

  // allow keyboard arrows to navigate when multipliers present
  document.addEventListener('keydown', (e)=>{
    if(!multItems.length) return;
    if(e.key === 'ArrowLeft') { e.preventDefault(); setActive(activeIndex-1); }
    if(e.key === 'ArrowRight') { e.preventDefault(); setActive(activeIndex+1); }
  });

  initMults();
  updateScoreDisplay();
});
