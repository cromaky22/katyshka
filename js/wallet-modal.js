// WALLET MODAL — two-step: dropdown under balance, then centred wallet
(function(){
  'use strict';

  var isGame = /(double|dreamcatcher|nvuti|crash|mines|coinflip|tower|wheel|goldwest|dice|plinko)\.html$/i.test(location.pathname);
  var trigger = document.getElementById('balTrigger');
  if (isGame || !trigger) return;

  function fmt(n){ var v=Number(n); return isNaN(v)?'0.00':v.toFixed(2); }
  function msg(el,t,y){ el.textContent=t; el.className='m-msg show '+(y||'info'); }
  function clr(el){ el.className='m-msg'; }

  if (!document.getElementById('walletModal')) {
    // DROPDOWN under balance
    var dd = document.createElement('div');
    dd.id = 'walletModal';
    dd.className = 'wallet-modal';
    dd.setAttribute('aria-hidden','true');
    dd.style.display='none';

    var centre = document.createElement('div');
    centre.id = 'walletCentre';
    centre.className = 'wallet-centre';
    centre.setAttribute('aria-hidden','true');
    centre.style.display='none';

    var sheet = '\
<div class="wmodal-sheet">\
  <div class="wmodal-handle"></div>\
  <div class="wmodal-head">\
    <div class="wmodal-title" data-title>💼 Баланс</div>\
    <button class="wmodal-close" data-close>✕</button>\
  </div>\
  <div class="wmodal-panel active" data-panel="overview">\
    <div class="modal-bal" style="margin-bottom:10px">\
      <div class="modal-bal-label">Основной баланс</div>\
      <div class="modal-bal-val">$<span data-main-bal>0.00</span></div>\
    </div>\
    <div class="modal-bal" style="margin-bottom:14px">\
      <div class="modal-bal-label">Отыгрыш (Wager)</div>\
      <div class="modal-bal-val" style="color:#ff6b9d">$<span data-wager-bal>0.00</span></div>\
    </div>\
    <button class="modal-btn m-wd" data-open-wallet>💼 Кошелёк</button>\
  </div>\
  <div class="wmodal-panel" data-panel="wallet">\
    <div class="wmodal-tabs">\
      <button class="wmodal-tab active" data-tab="dep">📥 ПОПОЛНЕНИЕ</button>\
      <button class="wmodal-tab" data-tab="wd">📤 ВЫВОД</button>\
      <button class="wmodal-tab" data-tab="hist">📋 ИСТОРИЯ</button>\
    </div>\
    <div class="wmodal-sub-panel active" data-sub="dep">\
      <div class="modal-sub">Основной баланс</div>\
      <div class="modal-bal">\
        <div class="modal-bal-label">Баланс</div>\
        <div class="modal-bal-val">$<span data-dep-bal>0.00</span></div>\
      </div>\
      <div class="modal-lbl">Способ оплаты</div>\
      <div class="modal-methods">\
        <div class="modal-method sel" data-pay="cb"><span class="ico"><img src="assets/cryptobot.jpg" alt="CryptoBot" style="width:26px;height:26px;border-radius:50%;object-fit:cover"></span><span class="nm">CryptoBot</span></div>\
        <div class="modal-method" data-pay="xr"><span class="ico"><img src="assets/xrocket.jpg" alt="xRocket" style="width:26px;height:26px;border-radius:50%;object-fit:cover"></span><span class="nm">xRocket</span></div>\
      </div>\
      <div class="modal-lbl">Сумма (USDT)</div>\
      <input class="modal-input" data-amt type="number" min="0.1" step="0.1" value="10">\
      <div class="modal-quick">\
        <button class="modal-q" data-v="1">$1</button>\
        <button class="modal-q" data-v="5">$5</button>\
        <button class="modal-q" data-v="10">$10</button>\
        <button class="modal-q" data-v="25">$25</button>\
        <button class="modal-q" data-v="50">$50</button>\
        <button class="modal-q" data-v="100">$100</button>\
      </div>\
      <button class="modal-btn m-dep" data-dep-btn>💳 Пополнить</button>\
      <div class="m-msg" data-dep-msg></div>\
    </div>\
    <div class="wmodal-sub-panel" data-sub="wd">\
      <div class="modal-sub">Доступно к выводу</div>\
      <div class="modal-bal">\
        <div class="modal-bal-label">Вывод</div>\
        <div class="modal-bal-val">$<span data-wd-bal>0.00</span></div>\
      </div>\
      <div class="modal-lbl">Способ вывода</div>\
      <div class="modal-methods">\
        <div class="modal-method sel" data-mpay="cb"><span class="ico"><img src="assets/cryptobot.jpg" alt="CryptoBot" style="width:26px;height:26px;border-radius:50%;object-fit:cover"></span><span class="nm">CryptoBot</span></div>\
        <div class="modal-method" data-mpay="xr"><span class="ico"><img src="assets/xrocket.jpg" alt="xRocket" style="width:26px;height:26px;border-radius:50%;object-fit:cover"></span><span class="nm">xRocket</span></div>\
      </div>\
      <div class="modal-lbl">Сумма вывода (USDT)</div>\
      <input class="modal-input" data-wd-amt type="number" min="1" step="0.1" value="" placeholder="Мин. $1">\
      <div class="m-recv">К получению: $<span data-rec>0.00</span> <span style="font-size:10px;color:var(--muted)">(комиссия 3%)</span></div>\
      <button class="modal-btn m-wd" data-wd-btn disabled>📤 Вывести</button>\
      <div class="m-info">Мин. вывод $1 / Комиссия 3% / Автоматический вывод</div>\
      <div class="m-msg" data-wd-msg></div>\
    </div>\
    <div class="wmodal-sub-panel" data-sub="hist">\
      <div data-tx-list><div class="m-empty">Загрузка...</div></div>\
    </div>\
  </div>\
</div>';

    dd.innerHTML = sheet;
    centre.innerHTML = sheet;

    var triggerEl = document.getElementById('balTrigger');
    if (triggerEl) {
      triggerEl.style.position = 'relative';
      triggerEl.appendChild(dd);
    } else {
      document.body.appendChild(dd);
    }
    document.body.appendChild(centre);
  }

  var dropdown = document.getElementById('walletModal');
  var centre = document.getElementById('walletCentre');
  if (!dropdown || !centre) return;

  var payMethod = 'cb', wdPay = 'cb';

  function openDropdown(){
    dropdown.style.display='';
    dropdown.setAttribute('aria-hidden','false');
    dropdown.classList.add('open');
    syncBalances(dropdown);
  }
  function closeDropdown(){
    dropdown.classList.remove('open');
    dropdown.setAttribute('aria-hidden','true');
    setTimeout(function(){ if(!dropdown.classList.contains('open')) dropdown.style.display='none'; },220);
  }
  function openCentre(){
    centre.style.display='';
    centre.setAttribute('aria-hidden','false');
    centre.classList.add('open');
    syncBalances(centre);
  }
  function closeCentre(){
    centre.classList.remove('open');
    centre.setAttribute('aria-hidden','true');
    setTimeout(function(){ if(!centre.classList.contains('open')) centre.style.display='none'; },220);
  }

  trigger.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    if (!dropdown.classList.contains('open')) { closeCentre(); openDropdown(); }
  });

  document.addEventListener('click', function(e){
    if (dropdown.classList.contains('open') && !dropdown.contains(e.target) && e.target !== trigger) closeDropdown();
    if (centre.classList.contains('open') && !centre.contains(e.target)) closeCentre();
  });

  function syncBalances(root){
    if (!window.Balance) return;
    var v = Balance.get();
    var r = root || document;
    var main = r.querySelector('[data-main-bal]');
    var depBal = r.querySelector('[data-dep-bal]');
    var wdBal = r.querySelector('[data-wd-bal]');
    var hbal = document.getElementById('hbal');
    if (main) main.textContent = fmt(v);
    if (depBal) depBal.textContent = fmt(v);
    if (wdBal) wdBal.textContent = fmt(v);
    if (hbal) hbal.textContent = fmt(v);
  }

  function showPanel(root, name){
    var overview = root.querySelector('[data-panel="overview"]');
    var wallet = root.querySelector('[data-panel="wallet"]');
    var title = root.querySelector('[data-title]');
    if (name==='wallet'){
      if(overview) overview.classList.remove('active');
      if(wallet) wallet.classList.add('active');
      if(title) title.textContent='💼 Кошелёк';
    } else {
      if(wallet) wallet.classList.remove('active');
      if(overview) overview.classList.add('active');
      if(title) title.textContent='💼 Баланс';
      syncBalances(root);
    }
  }

  // Delegate events inside dropdown
  dropdown.addEventListener('click', function(e){
    var openWallet = e.target.closest('[data-open-wallet]');
    if (openWallet) { e.preventDefault(); closeDropdown(); setTimeout(openCentre, 220); return; }
    var close = e.target.closest('[data-close]');
    if (close) { closeDropdown(); return; }
    var tab = e.target.closest('.wmodal-tab');
    if (tab) {
      var root = dropdown;
      root.querySelectorAll('.wmodal-tab').forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.dataset.tab;
      root.querySelectorAll('.wmodal-sub-panel').forEach(function(p){ p.classList.toggle('active', p.dataset.sub===target); });
      if (target==='hist') loadHistory(dropdown);
      return;
    }
    var method = e.target.closest('.modal-method');
    if (method) {
      var cat = method.parentElement && method.parentElement.dataset.pay ? 'dep' : 'wd';
      var list = dropdown.querySelectorAll((cat==='dep'?'#m-dep ':'#m-wd ')+'.modal-method');
      list.forEach(function(x){ x.classList.remove('sel'); });
      method.classList.add('sel');
      payMethod = method.dataset.pay || wdPay;
      if (cat==='wd') wdPay = method.dataset.mpay || 'cb';
      return;
    }
    var q = e.target.closest('.modal-q');
    if (q) {
      var inp = dropdown.querySelector('[data-amt]');
      var cur = parseFloat(inp.value)||0;
      inp.value = Math.max(0.1, cur + parseFloat(q.dataset.v||0)).toFixed(2);
      return;
    }
    var depBtn = e.target.closest('[data-dep-btn]');
    if (depBtn) { doDeposit(dropdown); return; }
    var wdBtn = e.target.closest('[data-wd-btn]');
    if (wdBtn) { doWithdraw(dropdown); return; }
  });

  dropdown.addEventListener('input', function(e){
    var wdAmt = e.target.closest('[data-wd-amt]');
    if (wdAmt) {
      var v = parseFloat(wdAmt.value)||0;
      var rec = dropdown.querySelector('[data-rec]');
      var wdBtn = dropdown.querySelector('[data-wd-btn]');
      if (rec) rec.textContent = fmt(Math.max(0, v*0.97));
      if (wdBtn) wdBtn.disabled = v < 1;
    }
  });

  // Delegate events inside centre modal
  centre.addEventListener('click', function(e){
    var close = e.target.closest('[data-close]');
    if (close) { closeCentre(); return; }
    var tab = e.target.closest('.wmodal-tab');
    if (tab) {
      var root = centre;
      root.querySelectorAll('.wmodal-tab').forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.dataset.tab;
      root.querySelectorAll('.wmodal-sub-panel').forEach(function(p){ p.classList.toggle('active', p.dataset.sub===target); });
      if (target==='hist') loadHistory(centre);
      return;
    }
    var method = e.target.closest('.modal-method');
    if (method) {
      var cat = method.parentElement && method.parentElement.dataset.pay ? 'dep' : 'wd';
      var list = centre.querySelectorAll((cat==='dep'?'#m-dep ':'#m-wd ')+'.modal-method');
      list.forEach(function(x){ x.classList.remove('sel'); });
      method.classList.add('sel');
      payMethod = method.dataset.pay || 'cb';
      if (cat==='wd') wdPay = method.dataset.mpay || 'cb';
      return;
    }
    var q = e.target.closest('.modal-q');
    if (q) {
      var inp = centre.querySelector('[data-amt]');
      var cur = parseFloat(inp.value)||0;
      inp.value = Math.max(0.1, cur + parseFloat(q.dataset.v||0)).toFixed(2);
      return;
    }
    var depBtn = e.target.closest('[data-dep-btn]');
    if (depBtn) { doDeposit(centre); return; }
    var wdBtn = e.target.closest('[data-wd-btn]');
    if (wdBtn) { doWithdraw(centre); return; }
  });

  centre.addEventListener('input', function(e){
    var wdAmt = e.target.closest('[data-wd-amt]');
    if (wdAmt) {
      var v = parseFloat(wdAmt.value)||0;
      var rec = centre.querySelector('[data-rec]');
      var wdBtn = centre.querySelector('[data-wd-btn]');
      if (rec) rec.textContent = fmt(Math.max(0, v*0.97));
      if (wdBtn) wdBtn.disabled = v < 1;
    }
  });

  function doDeposit(root){
    var amt = parseFloat(root.querySelector('[data-amt]').value)||0;
    if (amt<0.1){ msg(root.querySelector('[data-dep-msg]'),'Мин. сумма $0.1','err'); return; }
    var btn = root.querySelector('[data-dep-btn]'); btn.disabled=true; btn.textContent='⏳ Создание...';
    clr(root.querySelector('[data-dep-msg]'));
    var ep = payMethod==='xr' ? '/api/invoice/xrocket' : '/api/invoice';
    var uid = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid')||'';
    fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,amount:amt})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.ok && d.payUrl){
        msg(root.querySelector('[data-dep-msg]'),'✅ Счёт создан! Переход на оплату...','ok');
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
          window.Telegram.WebApp.openLink(d.payUrl, {try_instant_view:false});
        } else {
          window.location.href = d.payUrl;
        }
      } else {
        msg(root.querySelector('[data-dep-msg]'),'Ошибка: '+(d.error||'unknown'),'err');
      }
    }).catch(function(e){ msg(root.querySelector('[data-dep-msg]'),'Ошибка сети: '+e.message,'err'); })
    .finally(function(){ btn.disabled=false; btn.textContent='💳 Пополнить'; });
  }

  function doWithdraw(root){
    var amt = parseFloat(root.querySelector('[data-wd-amt]').value)||0;
    if (amt<1){ msg(root.querySelector('[data-wd-msg]'),'Мин. вывод $1','err'); return; }
    var fee = Math.round(amt*0.03*100)/100;
    var total = amt + fee;
    var curBal = window.Balance ? Balance.get() : 0;
    if(total>curBal){ msg(root.querySelector('[data-wd-msg]'),'❌ Недостаточно средств (комиссия 3%)','err'); return; }
    var btn = root.querySelector('[data-wd-btn]'); btn.disabled=true; btn.textContent='⏳ Вывод...';
    clr(root.querySelector('[data-wd-msg]'));
    var ep = wdPay==='xr' ? '/api/withdraw/xrocket' : '/api/withdraw/cryptobot';
    var uid = (window.Balance && Balance.getUserId()) || localStorage.getItem('tg_uid')||'';
    fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,amount:amt})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.ok){
        if(window.Balance) Balance.set(curBal - total);
        var txs = JSON.parse(localStorage.getItem('tx_history')||'[]');
        txs.unshift({type:'withdraw',userId:uid,amount:Number(amt).toFixed(2),status:'completed',date:new Date().toISOString(),provider:wdPay,fee:fee});
        if(txs.length>50) txs=txs.slice(0,50);
        localStorage.setItem('tx_history',JSON.stringify(txs));
        msg(root.querySelector('[data-wd-msg]'),'✅ Вывод на $'+fmt(amt)+' выполнен! Комиссия: $'+fmt(fee),'ok');
        syncBalances(root);
      } else {
        msg(root.querySelector('[data-wd-msg]'),'❌ Ошибка: '+(typeof d.error==='string'?d.error:JSON.stringify(d.error)),'err');
      }
    }).catch(function(e){ msg(root.querySelector('[data-wd-msg]'),'Ошибка сети: '+e.message,'err'); })
    .finally(function(){ btn.disabled=false; btn.textContent='📤 Вывести'; });
  }

  function loadHistory(root){
    var el = root.querySelector('[data-tx-list]');
    if (!el) return;
    var txs = JSON.parse(localStorage.getItem('tx_history')||'[]');
    if (!txs.length){ el.innerHTML='<div class="m-empty">История пуста</div>'; return; }
    el.innerHTML='';
    txs.forEach(function(tx){
      var row = document.createElement('div');
      row.className='tx-row';
      var isDep = tx.type==='deposit';
      row.innerHTML='<div><div class="t">'+(isDep?'📥 Пополнение':'📤 Вывод')+(tx.provider?' ('+tx.provider+')':'')+'</div><div class="d">'+new Date(tx.date).toLocaleDateString('ru')+' '+new Date(tx.date).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})+'</div></div><div class="a '+(isDep?'plus':'minus')+'">'+(isDep?'+$':'-$')+tx.amount+'<span class="s '+(tx.status==='completed'?'ok':'wait')+'">'+(tx.status==='completed'?'Выполнено':'Ожидание')+'</span></div>';
      el.appendChild(row);
    });
  }
})();
