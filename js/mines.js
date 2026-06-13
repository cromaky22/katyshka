// Basic Mines game logic — minimal prototype following coinflip patterns
(function(){
  const GRID_SIZE = 25;
  // 🎰 HOUSE EDGE: 5% — casino takes 5% from every win
  const HOUSE_EDGE = 0.05;
  
  // === STATS HELPER ===
  function recordStat(type, amount, detail){
    try{
      const userId = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid') || 'unknown';
      console.log('📤 recordStat:', { type, amount, detail, userId });
      fetch('/api/transaction', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId, type, amount: Math.abs(amount), detail: detail || 'Mines'})
      }).then(r => console.log('📥 Response:', r.status)).catch(e => console.error('❌ Error:', e));
    }catch(e){}
  }
  
  const gridEl = document.getElementById('minesGrid');
  const playBtn = document.getElementById('minesPlay');
  const cashoutBtn = document.getElementById('minesCashout');
  const winDisplay = document.getElementById('minesWin');
  const stakeInput = document.getElementById('minesStake');
  const minesSelect = document.getElementById('minesCount');
  const compactMinesCount = document.getElementById('compactMinesCount');
  const compactStepCount = document.getElementById('compactStepCount');
  const multipliersListEl = document.getElementById('multipliersList');
  const multLeftBtn = document.getElementById('multLeft');
  const multRightBtn = document.getElementById('multRight');
  // mobile/bottom controls
  const stakeInputBottom = document.getElementById('minesStakeBottom');
  const minesSelectBottom = document.getElementById('minesCountBottom');
  const playBtnBottom = document.getElementById('minesPlayBottom');
  const cashoutBtnBottom = document.getElementById('minesCashoutBottom');
  const openMinesPickerBtn = document.getElementById('openMinesPicker');
  const openMinesPickerBtnBottom = document.getElementById('openMinesPickerBottom');
  const minesPicker = document.getElementById('minesPicker');
  const minesPickerGrid = document.getElementById('minesPickerGrid');
  const closeMinesPicker = document.getElementById('closeMinesPicker');
  const halfBtn = document.getElementById('halfBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const stakeValueTopDisplay = document.getElementById('stakeValueTop');
  const minesCountDisplay = document.getElementById('minesCountDisplay');

  function getBalance(){ return Balance.get(); }
  function setBalance(v){ Balance.set(v); }

  // game state
  let gameActive = false;
  let mineSet = null;
  let revealedCount = 0;
  let currentStake = 0;
  let currentMines = 5;
  let multipliers = [];

  // set default multipliers list (index corresponds to revealedCount)
  function parseMultipliers(){
    // multipliers array starts from first reveal (1st step = index 0)
    const mines = gameActive ? currentMines : (parseInt(minesSelect.value,10) || currentMines || 0);
     const presets = {
       5: [1.21,1.35,1.49,1.66,1.86,2.11,2.41,2.76,3.21,3.82,4.63,5.88,7.83,10.93,15.39,25.91,75.51,415.81],
       6: [1.27,1.42,1.58,1.78,2.01,2.30,2.67,3.15,3.82,4.75,6.09,8.02,11.26,17.01,26.58,42.62,81.70,263.41],
       7: [1.34,1.52,1.74,2.01,2.34,2.77,3.35,4.13,5.21,6.92,9.60,13.65,21.41,35.17,58.26,119.18,338.04],
       8: [1.42,1.63,1.89,2.21,2.62,3.15,3.85,4.80,6.13,8.09,11.18,16.20,25.21,41.78,71.82,140.84],
       9: [1.51,1.76,2.08,2.49,3.01,3.70,4.65,5.96,7.84,10.61,14.94,21.62,32.70,51.39,83.85],
       10: [1.61,1.90,2.27,2.76,3.40,4.25,5.42,7.13,9.72,13.52,19.54,29.33,48.15,85.93],
       11: [1.73,2.07,2.48,3.02,3.74,4.72,6.10,8.10,11.12,15.70,23.07,35.12,54.27,87.21],
       12: [1.86,2.25,2.72,3.35,4.21,5.41,7.15,9.67,13.31,19.08,28.34,43.25,71.00],
       13: [2.02,2.47,3.03,3.78,4.82,6.34,8.56,11.88,16.83,24.61,36.82,61.13],
       14: [2.2,2.72,3.38,4.28,5.52,7.38,10.14,14.23,20.26,29.87,45.14],
       15: [2.42,3.03,3.81,4.90,6.41,8.59,11.71,16.44,23.51,35.17],
       16: [2.69,3.42,4.35,5.70,7.63,10.41,14.41,20.77],
       17: [3.03,3.90,5.03,6.76,9.26,13.09,19.01],
       18: [3.46,4.52,5.94,8.18,11.50,17.21],
       19: [4.04,5.41,7.33,10.48,15.89],
       20: [4.84,6.65,9.36,14.29],
       21: [6.06,8.60,12.94],
       22: [8.08,12.25],
       23: [12.12],
       24: [17.18]
     };
    // choose preset if available, otherwise fallback
    if(presets[mines]) multipliers = presets[mines].slice();
    else multipliers = [1.05,1.15,1.25,1.38,1.53,1.7,1.9,2.13,2.42,2.77,3.19,3.73,4.4,5.29,6.46,8.08,10.39,13.85,19.39,29.1,48.49,97,291];
    multipliersOffset = 0;
  }

  let multipliersOffset = 0;
  const multipliersVisible = 4;

  function formatShort(n){
    if(n === null || n === undefined) return '0';
    const num = Number(n);
    if(isNaN(num)) return String(n);
    if(Math.abs(num) >= 1e6) return (Math.round(num/1e4)/100).toString().replace(/\.0+$/,'') + 'M';
    if(Math.abs(num) >= 1e3) return (Math.round(num/10)/100).toString().replace(/\.0+$/,'') + 'k';
    // trim to max 2 decimals
    let s = (Math.round(num*100)/100).toString();
    if(/\.\d0$/.test(s)) s = s.replace(/0$/,'');
    return s;
  }

  function renderMultipliers(){
    if(!multipliersListEl) return;
    // ensure current highlighted multiplier is visible in the window
    if(revealedCount > 0){
      const curIdx = revealedCount - 1; // index in multipliers
      if(curIdx < multipliersOffset) multipliersOffset = curIdx;
      if(curIdx >= multipliersOffset + multipliersVisible) multipliersOffset = curIdx - multipliersVisible + 1;
    }
    multipliersListEl.innerHTML = '';
    const start = multipliersOffset;
    updateCompactStep();
    const end = Math.min(multipliers.length, start + multipliersVisible);
    for(let i=start;i<end;i++){
      const idx = i; // index in multipliers array
      const stepNumber = idx + 1; // human step number (1..)
      const val = multipliers[idx];
      const item = document.createElement('div');
      item.className = 'm-item';
      if(idx < revealedCount) item.classList.add('achieved');
      if(idx === revealedCount - 1) item.classList.add('current');
      const stepLabel = document.createElement('div'); stepLabel.className='mult-step'; stepLabel.textContent = `${stepNumber} шаг`;
      const valLabel = document.createElement('div'); valLabel.className='mult-value'; valLabel.textContent = `x${formatShort(val||0)}`;
      item.appendChild(stepLabel);
      item.appendChild(valLabel);
      multipliersListEl.appendChild(item);
    }
    // no debug full list here
  }

  if(multLeftBtn){ multLeftBtn.addEventListener('click', ()=>{ multipliersOffset = Math.max(0, multipliersOffset - multipliersVisible); renderMultipliers(); }); }
  if(multRightBtn){ multRightBtn.addEventListener('click', ()=>{ multipliersOffset = Math.min(Math.max(0,multipliers.length - multipliersVisible), multipliersOffset + multipliersVisible); renderMultipliers(); }); }

  // Keyboard navigation for multipliers
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft'){
      multipliersOffset = Math.max(0, multipliersOffset - multipliersVisible);
      renderMultipliers();
    } else if(e.key === 'ArrowRight'){
      multipliersOffset = Math.min(Math.max(0,multipliers.length - multipliersVisible), multipliersOffset + multipliersVisible);
      renderMultipliers();
    }
  });

  function updateWinDisplay(){
    const idx = revealedCount - 1;
    const mult = multipliers[idx] || 1;
    const win = Math.round((currentStake * mult * (1 - HOUSE_EDGE)) * 100)/100;
    // show win only during an active round with at least one revealed cell
    if(winDisplay){
      if(gameActive && revealedCount > 0){
        winDisplay.textContent = `$${win.toFixed(2)}`;
        winDisplay.style.visibility = '';
      } else {
        winDisplay.textContent = '';
        // keep element hidden visually until there is something to show
        winDisplay.style.visibility = 'hidden';
      }
    }
    // update cashout button label to reflect current potential win during round
    if(cashoutBtn){
      if(gameActive && revealedCount > 0){
        cashoutBtn.textContent = `Забрать $${win.toFixed(2)}`;
      } else {
        cashoutBtn.textContent = 'Забрать';
      }
    }
    // sync bottom cashout button if present
    if(cashoutBtnBottom){
      if(gameActive && revealedCount > 0){
        cashoutBtnBottom.style.display = '';
        cashoutBtnBottom.textContent = `Забрать $${win.toFixed(2)}`;
      } else {
        cashoutBtnBottom.style.display = 'none';
      }
    }
    return (gameActive && revealedCount > 0) ? win : 0;
  }

  function updateCompactStep(){
    if(!compactStepCount) return;
    const mines = gameActive ? currentMines : (parseInt(minesSelect.value,10) || currentMines || 0);
    const safeTotal = GRID_SIZE - mines;
    const remaining = Math.max(0, safeTotal - revealedCount);
    compactStepCount.textContent = remaining;
  }

  function createGrid(){
    gridEl.innerHTML = '';
    for(let i=0;i<GRID_SIZE;i++){
      const cell = document.createElement('button');
      cell.className = 'cell disabled';
      cell.dataset.index = i;
      cell.textContent = i+1;
      cell.addEventListener('click', onCellClick);
      gridEl.appendChild(cell);
    }
  }

  function buildMinesPicker(){
    if(!minesPickerGrid) return;
    minesPickerGrid.innerHTML = '';
    for(let v=5; v<=24; v++){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-cell';
      btn.dataset.val = v;
      btn.textContent = v;
      btn.addEventListener('click', ()=>{
        // set selects
        if(minesSelect) minesSelect.value = v;
        if(minesSelectBottom) minesSelectBottom.value = v;
        if(minesCountDisplay) minesCountDisplay.textContent = v;
        // sync other displays
        syncInputs();
        // highlight chosen
        const prev = minesPickerGrid.querySelector('.pick-cell.selected');
        if(prev) prev.classList.remove('selected');
        btn.classList.add('selected');
        // close after selection
        hideMinesPicker();
      });
      minesPickerGrid.appendChild(btn);
    }
  }

  function showMinesPicker(){
    if(!minesPicker) return;
    minesPicker.style.display = '';
    minesPicker.setAttribute('aria-hidden','false');
  }
  function hideMinesPicker(){
    if(!minesPicker) return;
    minesPicker.style.display = 'none';
    minesPicker.setAttribute('aria-hidden','true');
  }

  if(openMinesPickerBtn) openMinesPickerBtn.addEventListener('click', (e)=>{ e.stopPropagation(); buildMinesPicker(); showMinesPicker(); });
  if(openMinesPickerBtnBottom) openMinesPickerBtnBottom.addEventListener('click', (e)=>{ e.stopPropagation(); buildMinesPicker(); showMinesPicker(); });
  if(closeMinesPicker) closeMinesPicker.addEventListener('click', hideMinesPicker);
  // hide picker on outside click
  document.addEventListener('click', (e)=>{ if(minesPicker && minesPicker.style.display !== 'none' && !minesPicker.contains(e.target) && e.target !== openMinesPickerBtn && e.target !== openMinesPickerBtnBottom){ hideMinesPicker(); } });

  // Prevent native select dropdown from opening when clicking the select; open custom picker instead
  if(minesSelect){
    const openCustom = (e)=>{ e.preventDefault(); buildMinesPicker(); showMinesPicker(); };
    minesSelect.addEventListener('mousedown', openCustom);
    minesSelect.addEventListener('touchstart', openCustom);
    minesSelect.addEventListener('click', (e)=>{ /* also prevent click fallback */ e.preventDefault(); });
  }
  if(minesSelectBottom){
    const openCustomBottom = (e)=>{ e.preventDefault(); buildMinesPicker(); showMinesPicker(); };
    minesSelectBottom.addEventListener('mousedown', openCustomBottom);
    minesSelectBottom.addEventListener('touchstart', openCustomBottom);
    minesSelectBottom.addEventListener('click', (e)=>{ e.preventDefault(); });
  }

  function onCellClick(e){
    if(!gameActive) return; // block until play
    const cell = e.currentTarget;
    if(cell.classList.contains('revealed')) return;
    const idx = parseInt(cell.dataset.index,10);
    
    // hit mine
    if(mineSet && mineSet.has(idx)){
        // mark as revealed bomb and keep selected highlight
        cell.classList.add('revealed','bomb','selected');
        cell.textContent = '💣';
      
      // Показываем ВСЕ реальные мины
      revealAll(mineSet);
      
       gameActive = false;
       updateStatus('Проигрыш — мина найдена');
       recordStat('loss', currentStake, `Mines hit mine at step ${revealedCount + 1}`);
       if(window.mcStats) mcStats.addLoss(Math.abs(currentStake), 'Mines', `Мина на шаге ${revealedCount + 1}`);
        // reset controls and clear field after showing result
          if(cashoutBtn) cashoutBtn.style.display = 'none';
          if(playBtn) playBtn.style.display = '';
            renderMultipliers();
            updateWinDisplay();
            enableControls();
            updateCompactStep();
            setTimeout(resetField, 800);
        return;
    }
    // safe
      // mark revealed and keep selected highlight (persistent until next round)
      cell.classList.add('revealed','selected');
      cell.textContent = '✓';
    revealedCount++;
    updateStatus(`Открыто ${revealedCount} безопасных ячеек`);
    // after first safe cell, allow cashout
    if(revealedCount >= 1){
      if(cashoutBtn) cashoutBtn.style.display = '';
      if(cashoutBtnBottom) { cashoutBtnBottom.style.display = ''; }
      if(playBtn) playBtn.style.display = 'none';
      if(playBtnBottom) playBtnBottom.style.display = 'none';
    }
    // update multipliers panel highlight and win
    renderMultipliers();
    updateWinDisplay();
    updateCompactStep();
    const safeCount = GRID_SIZE - currentMines;
    if(revealedCount >= safeCount){
      // user cleared all safe cells — win
      const mult = multipliers[revealedCount - 1] || 1;
       const payout = Math.round(currentStake * mult * (1 - HOUSE_EDGE) * 100) / 100;
       setBalance(getBalance() + payout);
       recordStat('win', payout, `Mines cashout ${mult}x`);
       if(window.mcStats) mcStats.addWin(payout, 'Mines', `Все ${safeCount} ячеек открыты`);
       gameActive = false;
      revealAll(mineSet);
      updateStatus(`Выигрыш! +$${payout.toFixed(2)}`);
      updateCompactStep();
      setTimeout(resetField, 800);
    }
  }

  function randomMines(count){
    const set = new Set();
    while(set.size < count){
      set.add(Math.floor(Math.random()*GRID_SIZE));
    }
    return set;
  }

  function revealAll(mines){
    const cells = gridEl.querySelectorAll('.cell');
    cells.forEach((c,idx)=>{
      c.classList.add('revealed');
      if(mines.has(idx)){
        c.classList.add('bomb');
        c.textContent = '💣';
      } else {
        c.textContent = '✓';
      }
    });
  }

  function resetField(){
    // reset game state and recreate empty disabled grid
    gameActive = false;
    mineSet = null;
    revealedCount = 0;
    currentStake = 0;
    multipliersOffset = 0; // reset to step 1
    createGrid();
    disableCells();
    if(cashoutBtn) { cashoutBtn.style.display = 'none'; cashoutBtn.textContent = 'Забрать'; }
    if(playBtn) playBtn.style.display = '';
    if(cashoutBtnBottom) { cashoutBtnBottom.style.display = 'none'; }
    if(playBtnBottom) { playBtnBottom.style.display = ''; }
    enableControls();
    updateCompactStep();
    updateWinDisplay();
    renderMultipliers();
    updateStatus('Ставка не сделана');
  }

  // disable/enable UI controls while a round is active
  function disableControls(){
    if(stakeInput) stakeInput.disabled = true;
    if(stakeInputBottom) stakeInputBottom.disabled = true;
    if(minesSelect) minesSelect.disabled = true;
    if(minesSelectBottom) minesSelectBottom.disabled = true;
    if(halfBtn) halfBtn.disabled = true;
    if(doubleBtn) doubleBtn.disabled = true;
    if(openMinesPickerBtn) openMinesPickerBtn.disabled = true;
    if(openMinesPickerBtnBottom) openMinesPickerBtnBottom.disabled = true;
    if(playBtnBottom) playBtnBottom.disabled = true;
  }
  function enableControls(){
    if(stakeInput) stakeInput.disabled = false;
    if(stakeInputBottom) stakeInputBottom.disabled = false;
    if(minesSelect) minesSelect.disabled = false;
    if(minesSelectBottom) minesSelectBottom.disabled = false;
    if(halfBtn) halfBtn.disabled = false;
    if(doubleBtn) doubleBtn.disabled = false;
    if(openMinesPickerBtn) openMinesPickerBtn.disabled = false;
    if(openMinesPickerBtnBottom) openMinesPickerBtnBottom.disabled = false;
    if(playBtnBottom) playBtnBottom.disabled = false;
  }

  playBtn.addEventListener('click', ()=>{
    if(gameActive){ alert('Раунд уже идёт'); return; }
    const stake = parseFloat(stakeInput.value) || 0;
    const mines = parseInt(minesSelect.value,10) || 5;
    if(stake < 0.1){ alert('Минимальная ставка $0.10'); return; }
    if(stake > 200){ alert('Максимальная ставка $200'); return; }
    const balance = getBalance();
    if(stake > balance){ alert('Недостаточно средств'); return; }

     // Deduct stake and start round
      setBalance(balance - stake);
      recordStat('bet', stake, `Mines ${mines} mines`);
      if(window.mcStats) mcStats.addBet(Math.abs(stake), 'Mines', `${mines} мин`);
     currentStake = stake;
    currentMines = mines;
    mineSet = randomMines(mines);
    revealedCount = 0;
    gameActive = true;
    enableCells();
    // disable controls while round is active
    disableControls();
    // update remaining steps counter
    updateCompactStep();
    updateStatus('Раунд начат — откройте первую клетку');
    // hide play, hide cashout until first reveal
    if(playBtn) playBtn.style.display = 'none';
    if(cashoutBtn) cashoutBtn.style.display = 'none';
    if(playBtnBottom) playBtnBottom.style.display = 'none';
    if(cashoutBtnBottom) cashoutBtnBottom.style.display = 'none';
    parseMultipliers();
    renderMultipliers();
    updateWinDisplay();
      updateCompactStep();
  });

  // bottom play button uses same logic
  if(playBtnBottom){
    playBtnBottom.addEventListener('click', ()=>{
      // copy bottom inputs to top inputs and trigger main handler
      if(stakeInputBottom) stakeInput.value = stakeInputBottom.value;
      if(minesSelectBottom) minesSelect.value = minesSelectBottom.value;
      playBtn.click();
    });
  }

  if(cashoutBtn){
    cashoutBtn.addEventListener('click', ()=>{
      if(!gameActive) return;
      // calculate current win and award
       const win = updateWinDisplay();
       setBalance(getBalance() + win);
       if(window.mcStats) mcStats.addWin(win, 'Mines', `Кэш-аут на шаге ${revealedCount}`);
       updateStatus(`Вы забрали $${win.toFixed(2)}`);
      gameActive = false;
      revealAll(mineSet);
      // reset buttons
      cashoutBtn.style.display = 'none';
      if(cashoutBtnBottom) cashoutBtnBottom.style.display = 'none';
      if(playBtn) playBtn.style.display = '';
      if(playBtnBottom) playBtnBottom.style.display = '';
      // re-enable controls after round
      enableControls();
        updateWinDisplay();
        updateCompactStep();
        // clear field after showing result
        setTimeout(resetField, 800);
    });
    // mirror bottom cashout to call top cashout
    if(cashoutBtnBottom){ cashoutBtnBottom.addEventListener('click', ()=>{ if(cashoutBtn) cashoutBtn.click(); }); }
  }

  function enableCells(){
    const cells = gridEl.querySelectorAll('.cell');
    cells.forEach(c=>{ c.classList.remove('disabled'); c.classList.remove('revealed','bomb','selected'); c.textContent = (parseInt(c.dataset.index,10)+1); });
  }
  function disableCells(){
    const cells = gridEl.querySelectorAll('.cell');
    cells.forEach(c=>{ c.classList.add('disabled'); });
  }

  function updateStatus(text){
    const el = document.getElementById('minesStatus');
    if(el) el.textContent = text;
  }

  // sync bottom inputs when top changes and vice versa
  function syncInputs(){
    if(stakeInputBottom) stakeInputBottom.value = stakeInput.value;
    if(minesSelectBottom) minesSelectBottom.value = minesSelect.value;
    // update compact display values if present
    if(stakeValueTopDisplay) stakeValueTopDisplay.textContent = parseFloat(stakeInput.value || 0).toFixed(2);
    if(minesCountDisplay) minesCountDisplay.textContent = minesSelect.value;
    if(compactMinesCount) compactMinesCount.textContent = minesSelect.value;
    updateCompactStep();
    // immediately update multipliers and win display when mines selection changes
    parseMultipliers();
    renderMultipliers();
    updateWinDisplay();
  }
  stakeInput.addEventListener('input', syncInputs);
  minesSelect.addEventListener('change', syncInputs);
  if(stakeInputBottom){ stakeInputBottom.addEventListener('input', ()=>{ stakeInput.value = stakeInputBottom.value; }); }
  if(minesSelectBottom){ minesSelectBottom.addEventListener('change', ()=>{ minesSelect.value = minesSelectBottom.value; syncInputs(); }); }

  if(halfBtn){ halfBtn.addEventListener('click', ()=>{
    const cur = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.max(0.1, Math.round((cur/2)*100)/100); syncInputs();
  }); }
  if(doubleBtn){ doubleBtn.addEventListener('click', ()=>{
    const cur = parseFloat(stakeInput.value) || 0; stakeInput.value = Math.min(200, Math.round((cur*2)*100)/100); syncInputs();
  }); }

  // initialize
  createGrid();
  // sync balance display
  setBalance(getBalance());
  // sync initial inputs for bottom panel if present
  if(stakeInputBottom) stakeInputBottom.value = stakeInput.value;
  if(minesSelectBottom) minesSelectBottom.value = minesSelect.value;
  // update compact display initial values
  if(stakeValueTopDisplay) stakeValueTopDisplay.textContent = parseFloat(stakeInput.value || 0).toFixed(2);
  if(minesCountDisplay) minesCountDisplay.textContent = minesSelect.value;
  if(compactMinesCount) compactMinesCount.textContent = minesSelect.value;
  // start with cells disabled
  disableCells();
  updateStatus('Ставка не сделана');
  // prepare and render multipliers so they are visible initially
  parseMultipliers();
  renderMultipliers();
  updateCompactStep();
  updateWinDisplay();
  updateWinDisplay();
  updateCompactStep();
})();
