document.addEventListener('DOMContentLoaded', function(){
  // === STATS HELPER ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      const data = {userId, type, amount: Math.abs(amount), detail: detail || 'Coinflip'};
      if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            data.gps = `${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`;
            sendStat(data);
          },
          () => sendStat(data),
          {timeout: 3000}
        );
      } else {
        sendStat(data);
      }
    }catch(e){}
  }

  function sendStat(data){
    fetch('/api/transaction', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    }).catch(function(){});
  }
  
  const coin = document.getElementById('coin');
  const btnHead = document.getElementById('btnHead');
  const btnTail = document.getElementById('btnTail');
  const play = document.getElementById('play');
  const resultEl = document.getElementById('result');
  const stakeInput = document.getElementById('stake');
  const chainControls = document.getElementById('chainControls');
  const accumulatedDisplay = document.getElementById('accumulatedDisplay');
  const collectBtn = document.getElementById('collectBtn');
  const scoreRoundsEl = document.getElementById('scoreRounds');
  const scoreMultiplierEl = document.getElementById('scoreMultiplier');
  let choice = null;
  const stakeHeadEl = document.getElementById('stakeHead');
  const stakeTailEl = document.getElementById('stakeTail');
  const COINFLIP_HOUSE_EDGE = 0.07;
  let chainBaseStake = 0; // original stake for chain rounds (fixed)
  let chainPayout = 0; // last payout = chainBaseStake * multiplier

  // Balance helpers
  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  btnHead.addEventListener('click', ()=>{ choice = 'head'; btnHead.classList.add('active'); btnTail.classList.remove('active'); if(inChain){ startFlip(chainBaseStake, { skipDeduct: true }); } });
  btnTail.addEventListener('click', ()=>{ choice = 'tail'; btnTail.classList.add('active'); btnHead.classList.remove('active'); if(inChain){ startFlip(chainBaseStake, { skipDeduct: true }); } });

  function updateStakeDisplays(){
    const raw = stakeInput ? ('' + stakeInput.value).trim() : '';
    const val = raw !== '' ? (Number(stakeInput.value) || 0) : null;
    const MIN_STAKE = 0.1, MAX_STAKE = 200;
    if(val !== null){
      const v = Number(Math.min(MAX_STAKE, Math.max(MIN_STAKE, val)));
      if(stakeHeadEl) stakeHeadEl.textContent = `$ ${v.toFixed(2)}`;
      if(stakeTailEl) stakeTailEl.textContent = `$ ${v.toFixed(2)}`;
    } else {
      if(stakeHeadEl) stakeHeadEl.textContent = '';
      if(stakeTailEl) stakeTailEl.textContent = '';
    }
    // highlight selected button
    if(choice === 'head'){
      btnHead.classList.add('bet-on'); btnTail.classList.remove('bet-on');
    } else if(choice === 'tail'){
      btnTail.classList.add('bet-on'); btnHead.classList.remove('bet-on');
    } else {
      btnHead.classList.remove('bet-on'); btnTail.classList.remove('bet-on');
    }
    // update stake badges and selection only; play visibility is controlled
    // by game flow (initial play vs chain mode) to ensure first-bet uses `play`.
  }
  if(stakeInput) stakeInput.addEventListener('input', updateStakeDisplays);
  // update displays when choosing side
  btnHead.addEventListener('click', updateStakeDisplays);
  btnTail.addEventListener('click', updateStakeDisplays);

  function randomResult(){ return Math.random() < 0.47 ? 'head' : 'tail'; }

  function showResult(res){
    resultEl.textContent = res === 'head' ? 'Выпал ОРЕЛ' : 'Выпала РЕШКА';
  }
          // chain mode: when true, user continues by clicking side buttons

  function startFlip(baseStake, options){
    options = options || {};
    const skipDeduct = !!options.skipDeduct;
    if(!choice){ resultEl.textContent = 'Выберите Орел или Решка'; return }
    resultEl.textContent = '';
    if(baseStake <= 0){ resultEl.textContent = 'Укажите ставку больше 0'; return }
    if(coin.classList.contains('flip')) return;
    // check balance and deduct stake (unless skipDeduct true for chain continuation)
    const balBefore = getBalance();
    if(!skipDeduct){
      if(balBefore < baseStake){ resultEl.textContent = 'Недостаточно средств'; return }
       setBalance(Math.round((balBefore - baseStake) * 100) / 100);
       recordStat('bet', baseStake, `Coinflip ${choice === 'head' ? 'Орел' : 'Решка'}`);
       if(window.mcStats) mcStats.addBet(Math.abs(baseStake), 'Coinflip', `Выбор: ${choice === 'head' ? 'Орел' : 'Решка'}`);
    }
    const pendingResult = randomResult();
        coin.classList.remove('show-head','show-tail');
          if(accumulatedDisplay) accumulatedDisplay.textContent = `$ ${Number(chainPayout).toFixed(2)}`;
    btnHead.disabled = true; btnTail.disabled = true;
    coin.classList.remove('flip'); void coin.offsetWidth; coin.classList.add('flip');
    const onEnd = ()=>{
      if(pendingResult === 'head'){ coin.classList.remove('show-tail'); coin.classList.add('show-head'); }
      else { coin.classList.remove('show-head'); coin.classList.add('show-tail'); }
      showResult(pendingResult);
      const win = (choice === pendingResult);
      if(win){
        markPassed(currentMultiplierIdx);
        const mult = multipliersValues[currentMultiplierIdx] || 1;
        // payout should be stake * current multiplier (do not compound or sum previous accumulated)
        chainPayout = Number((baseStake * mult).toFixed(2));
        accumulated = chainPayout;
        // keep original stake for subsequent chain rounds
        chainBaseStake = baseStake;
        currentRound = Math.min(roundsTotal, currentRound + 1);
        if(currentMultiplierIdx < multipliersValues.length - 1) currentMultiplierIdx++;
        highlightCurrent(currentMultiplierIdx);
        updateScoreDisplay();
        resultEl.textContent += ' — Вы выиграли!';
        // enter chain mode: allow continuing by clicking side buttons
        inChain = true;
        // ensure play button is hidden while in chain mode (fade-out)
        if(play) play.classList.add('play-hidden');
        // lock stake input and show accumulated value + stop button
        if(stakeInput) stakeInput.disabled = true;
        if(chainControls) chainControls.style.display = 'flex';
        if(accumulatedDisplay) accumulatedDisplay.textContent = `$ ${Number(accumulated).toFixed(2)}`;
        // do not credit payout immediately — wait for user to collect
        // show collect button
        if(collectBtn) { collectBtn.style.display = ''; collectBtn.disabled = false; }
        // if chain completed by rounds or reaching last multiplier, end it
        if(currentRound >= roundsTotal || currentMultiplierIdx >= multipliersValues.length - 1){
          resultEl.textContent += ' — Цепочка завершена';
          // short delay so user sees result, then end chain
          setTimeout(()=>{ endChain(); }, 800);
        }
       } else {
         resultEl.textContent += ' — Проигрыш';
         recordStat('loss', baseStake, `Coinflip lost`);
         if(window.mcStats) mcStats.addLoss(Math.abs(baseStake), 'Coinflip', `Выбор: ${choice === 'head' ? 'Орел' : 'Решка'}, выпал ${pendingResult === 'head' ? 'Орел' : 'Решка'}`);
        resetProgress();
        inChain = false;
        // clear stake input so user must enter new amount
        if(stakeInput) stakeInput.value = '';
        updateStakeDisplays();
        // show play button again after loss so user can place a new initial bet
        if(play) play.classList.remove('play-hidden');
        if(stakeInput) stakeInput.disabled = false;
        if(chainControls) chainControls.style.display = 'none';
      }
      play.disabled = false;
      btnHead.disabled = false; btnTail.disabled = false;
      coin.classList.remove('flip');
    };
    coin.addEventListener('animationend', onEnd, { once: true });
  }

  // collect winnings when user presses collect button
  if(collectBtn){
    collectBtn.addEventListener('click', ()=>{
      const toAdd = Number(accumulated) || 0;
      if(toAdd <= 0) return;
       const balNow = getBalance();
       setBalance(Math.round((balNow + toAdd) * 100) / 100);
       recordStat('win', toAdd, `Coinflip chain win`);
       if(window.mcStats) mcStats.addWin(toAdd, 'Coinflip', `Выигрыш цепочки`);
      // after collecting, clear accumulated and hide collect button
      accumulated = 0; chainPayout = 0;
      if(accumulatedDisplay) accumulatedDisplay.textContent = `$ ${Number(accumulated).toFixed(2)}`;
      collectBtn.disabled = true; collectBtn.style.display = 'none';
      // end chain UI
      endChain();
    });
    // hide collect button initially
    collectBtn.style.display = 'none';
  }

  play.addEventListener('click', ()=>{
    const MIN_STAKE = 0.1, MAX_STAKE = 200;
    let raw = Number(stakeInput && stakeInput.value) || 0;
    if(isNaN(raw) || raw < MIN_STAKE) raw = MIN_STAKE;
    if(raw > MAX_STAKE) raw = MAX_STAKE;
    raw = Math.round(raw * 100) / 100;
    if(stakeInput) stakeInput.value = raw.toFixed(2);
    updateStakeDisplays();
    startFlip(raw);
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
    // Casino-favoring aggressive reductions
    const REDUCTION_THRESHOLD = 3.0;
    const REDUCTION_FACTOR = 0.80;
    const EXTRA_THRESHOLD = 8.0;
    const EXTRA_FACTOR = 0.85;
    const GLOBAL_REDUCE = 0.88;
    multipliersValues = multItems.map((it, idx)=>{
      const v = it.querySelector('.mult-value')?.textContent || it.textContent || '';
      const n = parseFloat((v+'').replace(/[^0-9.,]/g,'').replace(',','.'));
      const raw = isNaN(n) ? 1 : n;
      // initial adjustment based on thresholds
      let adjusted = raw;
      if(raw > REDUCTION_THRESHOLD) adjusted = Number((adjusted * REDUCTION_FACTOR).toFixed(6));
      if(raw > EXTRA_THRESHOLD) adjusted = Number((adjusted * EXTRA_FACTOR).toFixed(6));
      const finalVal = Number((adjusted * GLOBAL_REDUCE).toFixed(2));
      // update visible text to reflect adjusted multiplier
      const label = it.querySelector('.mult-value');
      if(label) label.textContent = `x${finalVal}`;
      return finalVal;
    });
  }

  function resetProgress(){
    currentRound = 0; currentMultiplierIdx = 0; accumulated = 0;
    multItems.forEach(it=>{ it.classList.remove('passed','current'); });
    if(multItems[0]) multItems[0].classList.add('current');
    updateScoreDisplay();
    // hide chain UI and re-enable stake input
    if(chainControls) chainControls.style.display = 'none';
    if(stakeInput) stakeInput.disabled = false;
    if(collectBtn){ collectBtn.style.display = 'none'; collectBtn.disabled = true; }
  }

  function updateScoreDisplay(){
    if(scoreRoundsEl) scoreRoundsEl.textContent = `${currentRound} из ${roundsTotal}`;
    // show current multiplier factor (not accumulated money)
    const curMult = multipliersValues[currentMultiplierIdx] || 1;
    if(scoreMultiplierEl) scoreMultiplierEl.textContent = `x${Number(curMult).toFixed(2)}`;
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

  function endChain(){
    inChain = false;
    // reset chain UI and make play visible
    if(stakeInput) stakeInput.disabled = false;
    if(chainControls) chainControls.style.display = 'none';
    if(play) play.classList.remove('play-hidden');
    // reset progress so next chain starts fresh
    resetProgress();
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
  updateStakeDisplays();
});
