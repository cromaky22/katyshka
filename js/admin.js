document.addEventListener('DOMContentLoaded', function(){
  const adminAuth = document.getElementById('adminAuth');
  const adminPanel = document.querySelectorAll('#adminPanel');
  const adminKeyInput = document.getElementById('adminKeyInput');
  const adminAuthBtn = document.getElementById('adminAuthBtn');
  
  // Check if admin key is stored
  let adminKey = sessionStorage.getItem('adminKey');
  
  if (!adminKey) {
    // Show auth form
    adminAuth.style.display = 'block';
    adminPanel.forEach(el => el.style.display = 'none');
    
    adminAuthBtn.addEventListener('click', () => {
      const key = adminKeyInput.value.trim();
      if (!key) {
        alert('Введите ключ');
        return;
      }
      sessionStorage.setItem('adminKey', key);
      location.reload();
    });
    return;
  }
  
  // Show admin panel
  adminAuth.style.display = 'none';
  adminPanel.forEach(el => el.style.display = 'block');
  const adminUsersPanel = document.getElementById('adminUsersPanel');
  if(adminUsersPanel) adminUsersPanel.style.display = 'block';
  
  // Add logout button to header
  const rightControls = document.querySelector('.app-header .right-controls');
  if (rightControls) {
    rightControls.innerHTML = '<button id="logoutBtn" class="btn-icon" style="color:red">Выход</button>';
    document.getElementById('logoutBtn').addEventListener('click', () => {
      sessionStorage.removeItem('adminKey');
      location.reload();
    });
  }
  
  const listEl = document.getElementById('promoList');
  const codeInput = document.getElementById('adminCode');
  const amountInput = document.getElementById('adminAmount');
  const maxInput = document.getElementById('adminMax');
  const addBtn = document.getElementById('adminAdd');

  function getPromosLocal(){
    try{ return JSON.parse(localStorage.getItem('mc_promos') || '[]') || []; }catch(e){ return []; }
  }
  function setPromosLocal(arr){ try{ localStorage.setItem('mc_promos', JSON.stringify(arr)); }catch(e){} }
  
  function fetchWithAuth(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    headers['x-admin-key'] = adminKey;
    console.log('🔐 Sending auth header:', headers);
    return fetch(url, { ...options, headers });
  }

  async function render(){
    let arr = null;
    try{
      // Always load from API first (it has the latest data from DB)
      const res = await fetch('/api/promos');
      if(res.ok){ arr = await res.json(); }
    }catch(e){ arr = null; }
    // Fallback to promos.json if API fails
    if(!Array.isArray(arr) || arr.length === 0){
      try{
        const res = await fetch('/promos.json');
        if(res.ok){ arr = await res.json(); }
      }catch(e){ arr = null; }
    }
    if(!Array.isArray(arr) || arr.length === 0){ arr = getPromosLocal(); }
    if(!Array.isArray(arr) || arr.length === 0){ listEl.innerHTML = '<div class="hint">Пока нет промокодов</div>'; return; }
    const rows = arr.map((it)=>{
      const code = it.code || '';
      const amt = Number(it.amount || 0).toFixed(2);
      const uses = Number(it.uses || 0);
      const maxUses = Number(it.maxUses || 0);
      const usesLabel = maxUses > 0 ? (uses + ' / ' + maxUses) : (''+uses);
      return `
        <div class="admin-row">
          <div class="admin-col admin-name"><strong>${code}</strong></div>
          <div class="admin-col admin-uses">${usesLabel}</div>
          <div class="admin-col admin-amount">$${amt}</div>
          <div class="admin-col admin-actions"><button data-code="${code}" class="btn small admin-del">Удалить</button></div>
        </div>`;
    }).join('');
    listEl.innerHTML = rows;
    Array.from(listEl.querySelectorAll('.admin-del')).forEach(b=>{
      b.addEventListener('click', async (e)=>{
        const code = b.dataset.code;
        if(!confirm('Удалить промокод ' + code + '?')) return;
        try{
          const res = await fetchWithAuth('/api/promos/' + encodeURIComponent(code), { method: 'DELETE' });
          if(!res.ok) throw new Error('server');
          render();
        }catch(err){
          const arrLocal = getPromosLocal();
          const idx = arrLocal.findIndex(p=> (p.code||'').toUpperCase() === (code||'').toUpperCase());
          if(idx !== -1){ arrLocal.splice(idx,1); setPromosLocal(arrLocal); render(); }
          else alert('Ошибка удаления');
        }
      });
    });
  }

  addBtn.addEventListener('click', async ()=>{
    const code = (codeInput.value||'').trim();
    const amt = parseFloat(amountInput.value);
    if(!code){ alert('Введите код'); return; }
    if(isNaN(amt) || amt <= 0){ alert('Введите корректную сумму'); return; }
    let maxUses = parseInt(maxInput && maxInput.value);
    if(isNaN(maxUses) || maxUses < 0) maxUses = 0;
    
    const newPromo = { code: code, amount: Math.round(amt*100)/100, maxUses: maxUses, uses: 0 };
    
    try{
      console.log('📤 Adding promo:', newPromo, 'with key:', adminKey);
      const res = await fetchWithAuth('/api/promos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPromo) });
      console.log('📥 Server response status:', res.status);
      if(!res.ok) {
        const errText = await res.text();
        alert('Ошибка сервера: ' + errText);
        return;
      }
      alert('✅ Промокод добавлен!');
      codeInput.value=''; amountInput.value=''; maxInput.value='';
      render();
    }catch(e){
      console.error('❌ Error adding promo:', e);
      alert('Ошибка: ' + e.message);
    }
  });

  render();
  
  // users management
  async function renderUsers(){
    const userEl = document.getElementById('userList');
    if(!userEl) return;
    try{
      const res = await fetchWithAuth('/api/users');
      if(!res.ok) throw new Error('no');
      const arr = await res.json();
      if(!Array.isArray(arr) || arr.length === 0){ userEl.innerHTML = '<div class="hint">Пока нет пользователей</div>'; return; }
      const rows = arr.map(u=>{
        const id = u.id || '';
        const name = ((u.first_name||'') + (u.last_name?(' '+u.last_name):'')).trim() || (u.username||'');
        const login = u.username || '';
        const bal = (u.balance != null) ? Number(u.balance).toFixed(2) : '100.00';
        return `
          <div class="admin-row" data-id="${id}">
            <div class="admin-col admin-name"><strong>${id}</strong><div class="muted">${name}</div></div>
            <div class="admin-col admin-uses">${login}</div>
            <div class="admin-col admin-amount"><input class="user-balance" value="${bal}" style="width:100px"></div>
            <div class="admin-col admin-actions"><button class="btn small user-save">Save</button></div>
          </div>`;
      }).join('');
      userEl.innerHTML = rows;
      Array.from(userEl.querySelectorAll('.user-save')).forEach(b=>{
        b.addEventListener('click', async ()=>{
          const row = b.closest('.admin-row');
          const id = row && row.dataset && row.dataset.id;
          const input = row.querySelector('.user-balance');
          const val = parseFloat(input.value) || 0;
          try{
            const res2 = await fetchWithAuth('/api/users/' + encodeURIComponent(id) + '/balance', { 
              method: 'PUT', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ balance: val }) 
            });
            if(!res2.ok) throw new Error('err');
            alert('Баланс обновлён');
            renderUsers();
          }catch(e){ alert('Ошибка обновления'); }
        });
      });
    }catch(e){ userEl.innerHTML = '<div class="hint">Ошибка загрузки пользователей</div>'; }
  }
  
  renderUsers();
});
