document.addEventListener('DOMContentLoaded', function(){
  const listEl = document.getElementById('promoList');
  const codeInput = document.getElementById('adminCode');
  const amountInput = document.getElementById('adminAmount');
  const maxInput = document.getElementById('adminMax');
  const addBtn = document.getElementById('adminAdd');

  function getPromos(){
    try{ return JSON.parse(localStorage.getItem('mc_promos') || '[]') || []; }catch(e){ return []; }
  }
  function setPromos(arr){ try{ localStorage.setItem('mc_promos', JSON.stringify(arr)); }catch(e){} }

  function render(){
    const arr = getPromos();
    if(arr.length === 0){ listEl.innerHTML = '<div class="hint">Пока нет промокодов</div>'; return; }
    const rows = arr.map((it, idx)=>{
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
          <div class="admin-col admin-actions"><button data-idx="${idx}" class="btn small admin-del">Удалить</button></div>
        </div>`;
    }).join('');
    listEl.innerHTML = rows;
    Array.from(listEl.querySelectorAll('.admin-del')).forEach(b=>{
      b.addEventListener('click', (e)=>{
        const idx = Number(b.dataset.idx);
        const arr = getPromos();
        arr.splice(idx,1);
        setPromos(arr);
        render();
      });
    });
  }

  addBtn.addEventListener('click', ()=>{
    const code = (codeInput.value||'').trim();
    const amt = parseFloat(amountInput.value);
    if(!code){ alert('Введите код'); return; }
    if(isNaN(amt) || amt <= 0){ alert('Введите корректную сумму'); return; }
    let maxUses = parseInt(maxInput && maxInput.value);
    if(isNaN(maxUses) || maxUses < 0) maxUses = 0;
    const arr = getPromos();
    // prevent duplicate codes (case-insensitive)
    const exists = arr.some(p=> (p.code||'').toLowerCase() === code.toLowerCase());
    if(exists){ alert('Код уже существует'); return; }
    arr.push({ code: code, amount: Math.round(amt*100)/100, uses: 0, maxUses: maxUses });
    setPromos(arr);
    codeInput.value=''; amountInput.value='';
    render();
  });

  render();
});
