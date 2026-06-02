document.addEventListener('DOMContentLoaded', function(){
  const listEl = document.getElementById('promoList');
  const codeInput = document.getElementById('adminCode');
  const amountInput = document.getElementById('adminAmount');
  const maxInput = document.getElementById('adminMax');
  const addBtn = document.getElementById('adminAdd');

  function getPromosLocal(){
    try{ return JSON.parse(localStorage.getItem('mc_promos') || '[]') || []; }catch(e){ return []; }
  }
  function setPromosLocal(arr){ try{ localStorage.setItem('mc_promos', JSON.stringify(arr)); }catch(e){} }

  async function render(){
    let arr = null;
    try{
      const res = await fetch('/api/promos');
      if(res.ok){ arr = await res.json(); }
    }catch(e){ arr = null; }
    // fallback to local storage
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
          const res = await fetch('/api/promos/' + encodeURIComponent(code), { method: 'DELETE' });
          if(!res.ok) throw new Error('server');
          render();
        }catch(err){
          // fallback: remove from local
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
    try{
      const res = await fetch('/api/promos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code, amount: Math.round(amt*100)/100, maxUses: maxUses }) });
      if(!res.ok) throw new Error('server');
      codeInput.value=''; amountInput.value=''; maxInput.value='';
      render();
    }catch(e){
      // server not available — persist locally and refresh
      const arrLocal = getPromosLocal();
      arrLocal.push({ code: code, amount: Math.round(amt*100)/100, uses: 0, maxUses: maxUses });
      setPromosLocal(arrLocal);
      codeInput.value=''; amountInput.value=''; maxInput.value='';
      render();
    }
  });

  render();
});
