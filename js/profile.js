document.addEventListener('DOMContentLoaded', function(){
  function getUser(){
    try{
      const tg = window.Telegram && window.Telegram.WebApp;
      if(tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user;
    }catch(e){}
    return null;
  }

  function getUserId(){
    const u = getUser();
    if(u && u.id) return String(u.id);
    return localStorage.getItem('tg_uid') || '—';
  }

  // === USER CARD ===
  const userId = getUserId();
  const tgUser = getUser();

  const nameEl = document.getElementById('profileName');
  const idDisplay = document.getElementById('profileIdDisplay');
  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarWrap = document.getElementById('profileAvatarBig');

  if(idDisplay) idDisplay.textContent = userId;

  function setInitials(name){
    if(!avatarWrap) return;
    let el = avatarWrap.querySelector('.avatar-initials');
    if(!el){ el=document.createElement('div'); el.className='avatar-initials'; avatarWrap.appendChild(el); }
    const n = name || 'Игрок';
    el.textContent = n.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
    el.style.display = (avatarImg && avatarImg.src && avatarImg.style.display !== 'none') ? 'none' : 'flex';
  }

  function applyUser(name, photoUrl){
    if(name && nameEl) nameEl.textContent = name;
    if(photoUrl && avatarImg){
      avatarImg.src = photoUrl;
      avatarImg.style.display = '';
      avatarImg.onerror = function(){ this.style.display='none'; };
    }
    setInitials(name);
  }

  // Set initial from TG
  if(tgUser){
    const tgName = tgUser.username || ((tgUser.first_name||'') + (tgUser.last_name?' '+tgUser.last_name:'')).trim() || 'Игрок';
    applyUser(tgName, tgUser.photo_url);
  }

  // Load profile data from server — only update if server has newer data
  async function loadUserProfile(){
    try{
      const res = await fetch('/api/users?id=' + encodeURIComponent(userId));
      const data = await res.json();
      if(data && data.balance !== undefined){
        const serverName = data.first_name || data.username;
        if(serverName && nameEl && nameEl.textContent === 'Игрок') applyUser(serverName, null);
        if(data.avatar && avatarImg && !avatarImg.src) applyUser(null, data.avatar);
        const balEl = document.querySelector('.balance-value');
        if(balEl) balEl.textContent = Number(data.balance).toFixed(2);
      }
    }catch(e){
      console.error('Profile load error:', e);
    }
  }

  loadUserProfile();

  // === STATS (from server) ===
  async function loadStats(){
    try{
      const res = await fetch('/api/stats?userId=' + encodeURIComponent(userId));
      const data = await res.json();
      console.log('📊 Stats:', data);
      
      // Finance
      document.getElementById('statDeposit').textContent = '$' + (data.deposits || 0).toFixed(2);
      document.getElementById('statWithdraw').textContent = '$' + (data.withdraws || 0).toFixed(2);
      document.getElementById('statTotalWin').textContent = '$' + (data.totalWin || 0).toFixed(2);
      document.getElementById('statMaxWin').textContent = '$' + (data.maxWin || 0).toFixed(2);
      
      // Games
      document.getElementById('statGames').textContent = data.games || 0;
      document.getElementById('statWins').textContent = data.wins || 0;
      document.getElementById('statLosses').textContent = data.losses || 0;
      document.getElementById('statWinRate').textContent = (data.winRate || 0) + '%';
      document.getElementById('statTotalBets').textContent = '$' + (data.totalBets || 0).toFixed(2);
      
      // History
      const historyEmpty = document.getElementById('historyEmpty');
      const historyList = document.getElementById('historyList');
      const history = data.history || [];
      
      if(history.length === 0){
        if(historyEmpty) historyEmpty.style.display = '';
        if(historyList) historyList.innerHTML = '';
      } else {
        if(historyEmpty) historyEmpty.style.display = 'none';
        if(historyList){
          history.sort((a,b) => (b.time||0) - (a.time||0));
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
    }catch(e){
      console.error('Stats error:', e);
    }
  }
  
  loadStats();

  // === PROMO MODAL ===
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
        const res = await fetch('/api/admin/balance', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({secret: 'obnul2026', targetId, amount, action: 'give'})
        });
        const data = await res.json();
        if(data.ok){
          if(targetId === userId && window.Balance) Balance.sync(data.balance);
          alert(`✅ Выдано $${amount.toFixed(2)} пользователю ${targetId}\nТекущий баланс: $${data.balance.toFixed(2)}`);
          document.getElementById('adminGiveId').value = '';
          document.getElementById('adminGiveAmount').value = '';
        } else {
          alert('❌ Ошибка: ' + (data.error || 'unknown'));
        }
      }catch(e){ alert('❌ Ошибка соединения'); }
    });
    
    // Take balance
    document.getElementById('adminTakeBtn').addEventListener('click', async function(){
      const targetId = document.getElementById('adminTakeId').value.trim();
      const amount = parseFloat(document.getElementById('adminTakeAmount').value);
      if(!targetId) return alert('Введите ID');
      if(isNaN(amount) || amount <= 0) return alert('Неверная сумма');
      try{
        const res = await fetch('/api/admin/balance', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({secret: 'obnul2026', targetId, amount, action: 'take'})
        });
        const data = await res.json();
        if(data.ok){
          if(targetId === userId && window.Balance) Balance.sync(data.balance);
          alert(`💸 Списано $${amount.toFixed(2)} у ${targetId}\nТекущий баланс: $${data.balance.toFixed(2)}`);
          document.getElementById('adminTakeId').value = '';
          document.getElementById('adminTakeAmount').value = '';
        } else {
          alert('❌ Ошибка: ' + (data.error || 'unknown'));
        }
      }catch(e){ alert('❌ Ошибка соединения'); }
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
          resultEl.innerHTML = `<div class="admin-user-info"><div>👤 <strong>${name}</strong></div><div class="uid">ID: ${targetId}</div><div class="admin-user-balance">💰 $${bal}</div></div>`;
          resultEl.classList.add('show');
        } else {
          resultEl.innerHTML = '❌ Пользователь не найден';
          resultEl.classList.add('show');
        }
      }catch(e){ resultEl.innerHTML = '❌ Ошибка'; resultEl.classList.add('show'); }
    });
    
     // Stats - show total for all players
     document.getElementById('adminStatsBtn').addEventListener('click', async function(){
       const resultEl = document.getElementById('adminStatsResult');
       try{
         const res = await fetch('/api/users');
         const users = await res.json();
         if(Array.isArray(users)){
           const total = users.length;
           const totalBal = users.reduce((s, u) => s + (u.balance || 0), 0).toFixed(2);
           resultEl.innerHTML = `<div class="admin-user-info"><div>👥 Пользователей: <strong>${total}</strong></div><div>💰 Общий баланс: <strong>$${totalBal}</strong></div></div>`;
           resultEl.classList.add('show');
         }
       }catch(e){ resultEl.innerHTML = '❌ Ошибка'; resultEl.classList.add('show'); }
     });
    
    // Load all players
    document.getElementById('adminLoadPlayersBtn').addEventListener('click', async function(){
      const listEl = document.getElementById('adminPlayersList');
      listEl.innerHTML = '⏳ Загрузка...';
      try{
        const res = await fetch('/api/users');
        const users = await res.json();
        if(Array.isArray(users) && users.length > 0){
          // Save to localStorage
          localStorage.setItem('mc_admin_players', JSON.stringify(users));
          renderPlayersList(users);
        } else {
          listEl.innerHTML = '❌ Нет игроков';
        }
      }catch(e){ listEl.innerHTML = '❌ Ошибка'; }
    });
    
    // Render players list
    function renderPlayersList(users){
      const listEl = document.getElementById('adminPlayersList');
      listEl.innerHTML = '';
      users.forEach(u => {
        const name = u.first_name || u.username || u.id;
        const bal = (u.balance || 0).toFixed(2);
        const item = document.createElement('div');
        item.className = 'admin-player-item';
        item.innerHTML = `
          <div class="admin-player-info">
            <div class="admin-player-name">${name}</div>
            <div class="admin-player-id">ID: ${u.id}</div>
          </div>
          <div class="admin-player-balance">$${bal}</div>
        `;
        item.addEventListener('click', () => showUserModal(u.id));
        listEl.appendChild(item);
      });
    }
    
    // Load saved players on page load
    const savedPlayers = localStorage.getItem('mc_admin_players');
    if(savedPlayers){
      try{
        const players = JSON.parse(savedPlayers);
        renderPlayersList(players);
      }catch(e){}
    }
    
    // Show user detail modal
    async function showUserModal(targetId){
      const modal = document.getElementById('adminUserModal');
      const body = document.getElementById('adminUserModalBody');
      body.innerHTML = '⏳ Загрузка...';
      modal.style.display = 'flex';
      
      try{
        // Get user info
        const userRes = await fetch('/api/users?id=' + targetId);
        const userData = await userRes.json();
        
        // Get user stats
        const statsRes = await fetch('/api/stats?userId=' + targetId);
        const stats = await statsRes.json();
        
        // Get IP from server response
        const ipInfo = stats.ip || 'Неизвестно';
        const name = userData.first_name || userData.username || targetId;
        const bal = (userData.balance || 0).toFixed(2);
        
        body.innerHTML = `
          <h3 style="margin-bottom:8px">👤 ${name}</h3>
          <p style="color:var(--muted);font-size:12px;margin-bottom:4px">ID: ${targetId}</p>
          <p style="color:var(--accent);font-size:12px;margin-bottom:16px">🌐 IP: ${ipInfo}</p>
          
          <div class="admin-user-stats">
            <div class="admin-user-stat">
              <div class="admin-user-stat-label">Баланс</div>
              <div class="admin-user-stat-value">$${bal}</div>
            </div>
            <div class="admin-user-stat">
              <div class="admin-user-stat-label">Игр</div>
              <div class="admin-user-stat-value">${stats.games || 0}</div>
            </div>
            <div class="admin-user-stat">
              <div class="admin-user-stat-label">Побед</div>
              <div class="admin-user-stat-value">${stats.wins || 0}</div>
            </div>
            <div class="admin-user-stat">
              <div class="admin-user-stat-label">Поражений</div>
              <div class="admin-user-stat-value">${stats.losses || 0}</div>
            </div>
            <div class="admin-user-stat">
              <div class="admin-user-stat-label">Винрейт</div>
              <div class="admin-user-stat-value">${stats.winRate || 0}%</div>
            </div>
            <div class="admin-user-stat">
              <div class="admin-user-stat-label">Макс. выигрыш</div>
              <div class="admin-user-stat-value">$${(stats.maxWin || 0).toFixed(2)}</div>
            </div>
          </div>
          
          <div class="admin-balance-input">
            <input type="number" class="admin-input" id="modalAmount" placeholder="Сумма">
            <button class="btn btn-sm" id="modalGiveBtn">Выдать</button>
            <button class="btn btn-sm btn-danger" id="modalTakeBtn">Списать</button>
          </div>
        `;
        
        document.getElementById('modalGiveBtn').addEventListener('click', async function(){
          const amount = parseFloat(document.getElementById('modalAmount').value);
          if(isNaN(amount) || amount <= 0) return alert('Неверная сумма');
          const res = await fetch('/api/admin/balance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({secret: 'obnul2026', targetId, amount, action: 'give'})
          });
          const data = await res.json();
          if(data.ok){
            alert(`✅ Выдано $${amount.toFixed(2)}`);
            showUserModal(targetId); // Refresh
          } else {
            alert('❌ Ошибка: ' + (data.error || 'unknown'));
          }
        });
        
        document.getElementById('modalTakeBtn').addEventListener('click', async function(){
          const amount = parseFloat(document.getElementById('modalAmount').value);
          if(isNaN(amount) || amount <= 0) return alert('Неверная сумма');
          const res = await fetch('/api/admin/balance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({secret: 'obnul2026', targetId, amount, action: 'take'})
          });
          const data = await res.json();
          if(data.ok){
            alert(`💸 Списано $${amount.toFixed(2)}`);
            showUserModal(targetId); // Refresh
          } else {
            alert('❌ Ошибка: ' + (data.error || 'unknown'));
          }
        });
        
      }catch(e){
        body.innerHTML = '❌ Ошибка загрузки';
      }
    }
    
    // Close modal
    document.getElementById('adminUserModalClose').addEventListener('click', function(){
      document.getElementById('adminUserModal').style.display = 'none';
    });
    document.getElementById('adminUserModal').addEventListener('click', function(e){
      if(e.target === this) this.style.display = 'none';
    });
    
    // Obnul - clear everything
    document.getElementById('adminObnulBtn').addEventListener('click', async function(){
      if(!confirm('⚠️ ВНИМАНИЕ!\n\nЭто обнулит ВСЕ балансы, ставки и промокоды!\n\nПродолжить?')) return;
      if(!confirm('Точно уверены? Это нельзя отменить!')) return;
      try{
        const res = await fetch('/api/admin/obnul', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({secret: 'obnul2026'})
        });
        const data = await res.json();
        if(data.ok){
          // Clear localStorage stats
          localStorage.removeItem('mc_games_played');
          localStorage.removeItem('mc_wins_count');
          localStorage.removeItem('mc_losses_count');
          localStorage.removeItem('mc_total_win_amount');
          localStorage.removeItem('mc_max_win');
          localStorage.removeItem('mc_total_bets');
          localStorage.removeItem('mc_deposits_total');
          localStorage.removeItem('mc_withdraws_total');
           localStorage.removeItem('mc_history');
           localStorage.removeItem('mc_admin_players');
           if(window.Balance) Balance.sync(0);
          alert('✅ Всё обнулено!');
          location.reload();
        } else {
          alert('❌ Ошибка: ' + (data.error || 'unknown'));
        }
      }catch(e){ alert('❌ Ошибка соединения'); }
     });
     
     // === PROMO MANAGEMENT ===
     
     // Create promo
     document.getElementById('adminPromoCreateBtn').addEventListener('click', async function(){
       const code = document.getElementById('adminPromoCode').value.trim().toUpperCase();
       const amount = parseFloat(document.getElementById('adminPromoAmount').value);
       const wagerMult = parseFloat(document.getElementById('adminPromoWager').value) || 5;
       const msgEl = document.getElementById('adminPromoMsg');
       if(!code){ msgEl.textContent = '❌ Введите код'; msgEl.classList.add('show'); return; }
       if(isNaN(amount) || amount <= 0){ msgEl.textContent = '❌ Неверная сумма'; msgEl.classList.add('show'); return; }
       try{
         const res = await fetch('/api/admin/promos', {
           method: 'POST',
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({secret: 'obnul2026', code, amount, wager_mult: wagerMult})
         });
         const data = await res.json();
         if(data.ok){
           msgEl.textContent = `✅ Промокод ${code} создан! Сумма: $${data.amount}`;
           msgEl.classList.add('show');
           document.getElementById('adminPromoCode').value = '';
           document.getElementById('adminPromoAmount').value = '';
         } else {
           msgEl.textContent = '❌ Ошибка: ' + (data.error || 'unknown');
           msgEl.classList.add('show');
         }
       }catch(e){ msgEl.textContent = '❌ Ошибка сети'; msgEl.classList.add('show'); }
     });
     
     // List promos
     document.getElementById('adminLoadPromosBtn').addEventListener('click', async function(){
       const listEl = document.getElementById('adminPromosList');
       listEl.innerHTML = '⏳ Загрузка...';
       try{
         const res = await fetch('/api/admin/promos?secret=obnul2026');
         const data = await res.json();
         if(data.ok && data.promos && data.promos.length > 0){
           listEl.innerHTML = '';
           data.promos.forEach(p => {
             const item = document.createElement('div');
             item.className = 'admin-player-item';
             item.innerHTML = `
               <div class="admin-player-info">
                 <div class="admin-player-name">🎟 ${p.code}</div>
                 <div class="admin-player-id">$${p.amount.toFixed(2)} · вагер ×${p.wager_mult} · активаций: ${p.uses}</div>
               </div>
               <button class="btn btn-sm btn-danger admin-promo-delete" data-code="${p.code}">✕</button>
             `;
             listEl.appendChild(item);
           });
           // Add delete handlers
           listEl.querySelectorAll('.admin-promo-delete').forEach(btn => {
             btn.addEventListener('click', async function(e){
               e.stopPropagation();
               const delCode = this.dataset.code;
               if(!confirm(`Удалить промокод ${delCode}?`)) return;
               try{
                 const res = await fetch('/api/admin/promos/' + delCode + '?secret=obnul2026', {method: 'DELETE'});
                 const data = await res.json();
                 if(data.ok){
                   alert('✅ Промокод удалён');
                   document.getElementById('adminLoadPromosBtn').click();
                 } else {
                   alert('❌ Ошибка: ' + (data.error || 'unknown'));
                 }
               }catch(e){ alert('❌ Ошибка сети'); }
             });
           });
         } else {
           listEl.innerHTML = '<div class="tx-empty">Промокодов нет</div>';
         }
       }catch(e){ listEl.innerHTML = '<div class="tx-empty">Ошибка загрузки</div>'; }
     });
   }
 });
