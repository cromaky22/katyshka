document.addEventListener('DOMContentLoaded', function(){
  function getUser(){
    try{
      const tg = window.Telegram && window.Telegram.WebApp;
      if(tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user;
    }catch(e){}
    try{ const s = localStorage.getItem('tg_user'); if(s) return JSON.parse(s); }catch(e){}
    return { id: 123456789, first_name: '', last_name: '', username: 'demouser', photo_url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%231a1f35" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="50" fill="%238892b0" text-anchor="middle" dy=".3em"%3E👤%3C/text%3E%3C/svg%3E' };
  }

  function getUserId(){
    const u = getUser();
    if(u && u.id) return String(u.id);
    return localStorage.getItem('tg_uid') || localStorage.getItem('mc_user_id') || '—';
  }

  function getUserName(){
    const u = getUser();
    if(u) return u.username || ((u.first_name||'') + (u.last_name?' '+u.last_name:'')).trim() || 'Игрок';
    return 'Игрок';
  }

  function getUserAvatar(){
    const u = getUser();
    if(u) return u.photo_url || u.avatar || '';
    return '';
  }

  function getUserInitials(){
    const n = getUserName();
    return n.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
  }

  // === Fill user card ===
  const userId = getUserId();
  const userName = getUserName();
  const userAvatar = getUserAvatar();

  const nameEl = document.getElementById('profileName');
  const idDisplay = document.getElementById('profileIdDisplay');
  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarWrap = document.getElementById('profileAvatarBig');

  if(nameEl) nameEl.textContent = userName;
  if(idDisplay) idDisplay.textContent = userId;

  if(avatarImg && userAvatar){ avatarImg.src = userAvatar; avatarImg.style.display=''; avatarImg.onerror=function(){this.style.display='none';}; }
  if(avatarWrap){
    let el = avatarWrap.querySelector('.avatar-initials');
    if(!el){ el=document.createElement('div'); el.className='avatar-initials'; avatarWrap.appendChild(el); }
    el.textContent = getUserInitials();
    el.style.display = userAvatar ? 'none' : 'flex';
  }

  // === Collect stats from localStorage ===
  // Each game writes to localStorage keys like:
  // mc_games_played, mc_total_wins, mc_total_bets, mc_max_win
  // mc_deposits_total, mc_withdraws_total
  // mc_history (JSON array of operations)

  let gamesPlayed = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalWinAmount = 0;
  let maxWin = 0;
  let totalBets = 0;
  let totalDeposits = 0;
  let totalWithdraws = 0;

  // Read from localStorage keys written by games
  gamesPlayed = parseInt(localStorage.getItem('mc_games_played') || '0');
  totalWins = parseInt(localStorage.getItem('mc_wins_count') || '0');
  totalLosses = parseInt(localStorage.getItem('mc_losses_count') || '0');
  totalWinAmount = parseFloat(localStorage.getItem('mc_total_win_amount') || '0');
  maxWin = parseFloat(localStorage.getItem('mc_max_win') || '0');
  totalBets = parseFloat(localStorage.getItem('mc_total_bets') || '0');
  totalDeposits = parseFloat(localStorage.getItem('mc_deposits_total') || '0');
  totalWithdraws = parseFloat(localStorage.getItem('mc_withdraws_total') || '0');

  // If no detailed stats, try to derive from history
  let history = [];
  try{ history = JSON.parse(localStorage.getItem('mc_history') || '[]'); }catch(e){}

  if(gamesPlayed === 0 && history.length > 0){
    history.forEach(h=>{
      if(h.type === 'bet'){ gamesPlayed++; totalBets += Math.abs(h.amount); }
      if(h.type === 'win'){ totalWins++; totalWinAmount += h.amount; if(h.amount > maxWin) maxWin = h.amount; }
      if(h.type === 'loss'){ totalLosses++; }
      if(h.type === 'deposit'){ totalDeposits += h.amount; }
      if(h.type === 'withdraw'){ totalWithdraws += Math.abs(h.amount); }
      if(h.type === 'promo'){ totalDeposits += h.amount; }
    });
  }

  // If still no win/loss counts, estimate from games and history
  if(totalWins === 0 && totalLosses === 0 && gamesPlayed > 0){
    const winItems = history.filter(h=>h.type==='win');
    const lossItems = history.filter(h=>h.type==='loss');
    totalWins = winItems.length;
    totalLosses = lossItems.length;
    winItems.forEach(h=>{ totalWinAmount+=h.amount; if(h.amount>maxWin)maxWin=h.amount; });
  }

  const winRate = gamesPlayed > 0 ? Math.round((totalWins / gamesPlayed) * 100) : 0;

  // === Fill finance stats ===
  const elDeposit = document.getElementById('statDeposit');
  const elWithdraw = document.getElementById('statWithdraw');
  const elTotalWin = document.getElementById('statTotalWin');
  const elMaxWin = document.getElementById('statMaxWin');
  if(elDeposit) elDeposit.textContent = '$' + totalDeposits.toFixed(2);
  if(elWithdraw) elWithdraw.textContent = '$' + totalWithdraws.toFixed(2);
  if(elTotalWin) elTotalWin.textContent = '$' + totalWinAmount.toFixed(2);
  if(elMaxWin) elMaxWin.textContent = '$' + maxWin.toFixed(2);

  // === Fill game stats ===
  const elGames = document.getElementById('statGames');
  const elWins = document.getElementById('statWins');
  const elLosses = document.getElementById('statLosses');
  const elWinRate = document.getElementById('statWinRate');
  const elTotalBets = document.getElementById('statTotalBets');
  if(elGames) elGames.textContent = gamesPlayed;
  if(elWins) elWins.textContent = totalWins;
  if(elLosses) elLosses.textContent = totalLosses;
  if(elWinRate) elWinRate.textContent = winRate + '%';
  if(elTotalBets) elTotalBets.textContent = '$' + totalBets.toFixed(2);

  // === Fill history ===
  const historyEmpty = document.getElementById('historyEmpty');
  const historyList = document.getElementById('historyList');

  if(history.length === 0){
    if(historyEmpty) historyEmpty.style.display = '';
    if(historyList) historyList.innerHTML = '';
  } else {
    if(historyEmpty) historyEmpty.style.display = 'none';
    if(historyList){
      // Sort newest first
      history.sort((a,b) => (b.time||0) - (a.time||0));
      // Show last 50
      const items = history.slice(0, 50);
      historyList.innerHTML = '';
      items.forEach(h=>{
        const el = document.createElement('div');
        el.className = 'history-item';

        const iconMap = { bet:'🎰', win:'🏆', loss:'💀', deposit:'📥', withdraw:'📤', promo:'🎁' };
        const titleMap = { bet:'Ставка', win:'Выигрыш', loss:'Проигрыш', deposit:'Пополнение', withdraw:'Вывод', promo:'Промокод' };
        const icon = iconMap[h.type] || '📋';
        const title = h.title || titleMap[h.type] || h.type;
        const sub = h.game ? h.game + (h.detail ? ' · ' + h.detail : '') : (h.detail || '');
        const amountClass = h.type === 'win' || h.type === 'deposit' || h.type === 'promo' ? 'positive' : 'negative';
        const amountPrefix = h.type === 'win' || h.type === 'deposit' || h.type === 'promo' ? '+' : '-';
        const amountVal = h.type === 'loss' ? Math.abs(h.amount) : h.amount;

        let dateStr = '';
        if(h.time){
          const d = new Date(h.time);
          dateStr = d.toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit'}) + ' ' + d.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
        }

        el.innerHTML = `
          <div class="history-icon type-${h.type}">${icon}</div>
          <div class="history-main">
            <div class="history-title">${title}</div>
            ${sub ? `<div class="history-sub">${sub}</div>` : ''}
          </div>
          <div class="history-right">
            <div class="history-amount ${amountClass}">${amountPrefix}$${amountVal.toFixed(2)}</div>
            ${dateStr ? `<div class="history-date">${dateStr}</div>` : ''}
          </div>
        `;
        historyList.appendChild(el);
      });
    }
  }

  // === Promo modal ===
  const promoBtn = document.getElementById('pdPromoBtn');
  const promoModal = document.getElementById('promoModal');
  if(promoBtn && promoModal){
    promoBtn.addEventListener('click', function(){
      promoModal.style.display = '';
      promoModal.setAttribute('aria-hidden','false');
      const input = document.getElementById('promoCodeInput');
      if(input) input.focus();
    });
  }

  // === ADMIN PANEL ===
  const ADMIN_ID = '7239160695';
  const adminPanel = document.getElementById('adminPanel');
  
  if(adminPanel && userId === ADMIN_ID){
    adminPanel.style.display = '';
    
    // Give balance
    document.getElementById('adminGiveBtn').addEventListener('click', async function(){
      const targetId = document.getElementById('adminGiveId').value.trim();
      const amount = parseFloat(document.getElementById('adminGiveAmount').value);
      if(!targetId) return alert('Введите ID');
      if(isNaN(amount) || amount <= 0) return alert('Неверная сумма');
      try{
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({id: targetId, balance: amount})
        });
        const data = await res.json();
        if(data.ok){
          alert(`✅ Выдано $${amount.toFixed(2)} пользователю ${targetId}\nТекущий баланс: $${data.balance.toFixed(2)}`);
          document.getElementById('adminGiveId').value = '';
          document.getElementById('adminGiveAmount').value = '';
        } else {
          alert('❌ Ошибка: ' + (data.error || 'unknown'));
        }
      }catch(e){
        alert('❌ Ошибка соединения');
      }
    });
    
    // Take balance
    document.getElementById('adminTakeBtn').addEventListener('click', async function(){
      const targetId = document.getElementById('adminTakeId').value.trim();
      const amount = parseFloat(document.getElementById('adminTakeAmount').value);
      if(!targetId) return alert('Введите ID');
      if(isNaN(amount) || amount <= 0) return alert('Неверная сумма');
      try{
        // Get current balance
        const getRes = await fetch('/api/users?id=' + targetId);
        const userData = await getRes.json();
        const currentBalance = userData.balance || 0;
        const newBalance = Math.max(0, currentBalance - amount);
        
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({id: targetId, balance: newBalance})
        });
        const data = await res.json();
        if(data.ok){
          alert(`💸 Списано $${amount.toFixed(2)} у ${targetId}\nБыло: $${currentBalance.toFixed(2)}\nТекущий: $${data.balance.toFixed(2)}`);
          document.getElementById('adminTakeId').value = '';
          document.getElementById('adminTakeAmount').value = '';
        } else {
          alert('❌ Ошибка: ' + (data.error || 'unknown'));
        }
      }catch(e){
        alert('❌ Ошибка соединения');
      }
    });
    
    // Search user
    document.getElementById('adminSearchBtn').addEventListener('click', async function(){
      const targetId = document.getElementById('adminSearchId').value.trim();
      if(!targetId) return alert('Введите ID');
      const resultEl = document.getElementById('adminSearchResult');
      try{
        const res = await fetch('/api/users?id=' + targetId);
        const data = await res.json();
        if(data && data.balance !== undefined){
          const name = data.first_name || data.username || targetId;
          const bal = (data.balance || 0).toFixed(2);
          resultEl.innerHTML = `
            <div class="admin-user-info">
              <div>👤 <strong>${name}</strong></div>
              <div class="uid">ID: ${targetId}</div>
              <div class="admin-user-balance">💰 $${bal}</div>
            </div>
          `;
          resultEl.classList.add('show');
        } else {
          resultEl.innerHTML = '❌ Пользователь не найден';
          resultEl.classList.add('show');
        }
      }catch(e){
        resultEl.innerHTML = '❌ Ошибка соединения';
        resultEl.classList.add('show');
      }
    });
    
    // Stats
    document.getElementById('adminStatsBtn').addEventListener('click', async function(){
      const resultEl = document.getElementById('adminStatsResult');
      try{
        const res = await fetch('/api/users');
        const users = await res.json();
        if(Array.isArray(users)){
          const total = users.length;
          const totalBal = users.reduce((s, u) => s + (u.balance || 0), 0).toFixed(2);
          resultEl.innerHTML = `
            <div class="admin-user-info">
              <div>👥 Пользователей: <strong>${total}</strong></div>
              <div>💰 Общий баланс: <strong>$${totalBal}</strong></div>
            </div>
          `;
          resultEl.classList.add('show');
        }
      }catch(e){
        resultEl.innerHTML = '❌ Ошибка';
        resultEl.classList.add('show');
      }
    });
    
    // Obnul
    document.getElementById('adminObnulBtn').addEventListener('click', async function(){
      if(!confirm('⚠️ ВНИМАНИЕ!\n\nЭто обнулит ВСЕ балансы, ставки и промокоды!\n\nПродолжить?')) return;
      if(!confirm('Точно уверены? Это действие нельзя отменить!')) return;
      try{
        const res = await fetch('/api/admin/obnul', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({secret: 'obnul2026'})
        });
        const data = await res.json();
        if(data.ok){
          alert('✅ Всё обнулено!');
        } else {
          alert('❌ Ошибка: ' + (data.error || 'unknown'));
        }
      }catch(e){
        alert('❌ Ошибка соединения');
      }
    });
  }
});
