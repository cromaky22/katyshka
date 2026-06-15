// WALLET MODAL — dropdown (fixed, in body) + fullscreen wallet overlay
(function(){
  'use strict';
  var isGame = /(double|dreamcatcher|nvuti|crash|mines|coinflip|tower|wheel|goldwest|dice|plinko)\.html$/i.test(location.pathname);
  var trigger = document.getElementById('balTrigger');
  if (isGame || !trigger) return;

  function fmt(n){ var v=Number(n); return isNaN(v)?'0.00':v.toFixed(2); }

  // === DROPDOWN (fixed, appended to body) ===
  if (!document.getElementById('walletDrop')) {
    var dd = document.createElement('div');
    dd.id = 'walletDrop';
    dd.style.cssText = 'position:fixed;z-index:999999;opacity:0;pointer-events:none;transform:translateY(-8px);transition:opacity .2s,transform .2s;overflow:hidden;width:280px;background:linear-gradient(180deg,rgba(12,16,30,0.98),rgba(8,12,24,0.98));border-radius:14px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 20px 60px rgba(0,0,0,0.6)';
    dd.innerHTML = '<div style="padding:14px">' +
      '<div style="text-align:center;padding:12px;background:rgba(0,0,0,0.2);border-radius:10px;margin-bottom:10px"><div style="font-size:11px;color:var(--muted)">Основной баланс</div><div style="font-size:28px;font-weight:900;color:#ffd700;margin-top:4px">$<span id="wdBal">0.00</span></div></div>' +
      '<div style="text-align:center;padding:10px;background:rgba(0,0,0,0.2);border-radius:10px;margin-bottom:8px"><div style="font-size:11px;color:var(--muted)">Отыгрыш (Wager)</div><div style="font-size:14px;font-weight:700;color:#ff6b9d;margin-top:2px">Осталось: $<span id="wdWager">0.00</span></div><div style="font-size:10px;color:var(--muted);margin-top:4px">Ввод: <span id="wdWithdraw">доступен</span></div></div>' +
      '<button id="wdOpen" style="width:100%;padding:12px;border-radius:10px;border:none;font-size:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#2196f3,#1565c0);color:#fff">💼 Кошелёк</button>' +
    '</div>';
    document.body.appendChild(dd);
  }

  // === FULLSCREEN WALLET OVERLAY ===
  if (!document.getElementById('walletFull')) {
    var wf = document.createElement('div');
    wf.id = 'walletFull';
    wf.style.cssText = 'position:fixed;inset:0;z-index:9999999;display:none;flex-direction:column;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px)';
    wf.innerHTML = '<div style="flex:1;display:flex;flex-direction:column;max-width:480px;width:100%;margin:auto;background:linear-gradient(180deg,rgba(12,16,30,0.98),rgba(8,12,24,0.98));border-radius:16px;max-height:90vh;overflow:hidden">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 6px"><div style="font-size:18px;font-weight:900;color:#fff">💼 Кошелёк</div><button id="wfClose" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;color:#fff;font-size:16px;cursor:pointer">✕</button></div>' +
      '<div style="display:flex;gap:4px;padding:4px 12px 8px">' +
        '<button class="wf-tab active" data-t="dep" style="flex:1;padding:8px;border:none;border-radius:8px;background:linear-gradient(135deg,#ff6b9d,#ffd700);color:#000;font-size:10px;font-weight:700;cursor:pointer">📥 ПОПОЛНЕНИЕ</button>' +
        '<button class="wf-tab" data-t="wd" style="flex:1;padding:8px;border:none;border-radius:8px;background:rgba(255,255,255,0.06);color:var(--muted);font-size:10px;font-weight:700;cursor:pointer">📤 ВЫВОД</button>' +
        '<button class="wf-tab" data-t="hist" style="flex:1;padding:8px;border:none;border-radius:8px;background:rgba(255,255,255,0.06);color:var(--muted);font-size:10px;font-weight:700;cursor:pointer">📋 ИСТОРИЯ</button>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;padding:0 14px 14px">' +
        '<div class="wf-p" data-p="dep">' +
          '<div style="text-align:center;padding:14px;background:rgba(0,0,0,0.2);border-radius:12px;margin-bottom:14px"><div style="font-size:11px;color:var(--muted)">Баланс</div><div style="font-size:28px;font-weight:900;color:#ffd700;margin-top:4px">$<span id="wfDepBal">0.00</span></div></div>' +
          '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Способ оплаты</div>' +
          '<div style="display:flex;gap:8px;margin-bottom:12px"><div class="wf-pay sel" data-pay="cb" style="flex:1;padding:12px;border-radius:12px;border:2px solid #4caf50;background:rgba(76,175,80,0.12);text-align:center;cursor:pointer"><img src="assets/cryptobot.jpg" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 4px"><span style="font-size:10px;font-weight:700;color:#fff">CryptoBot</span></div><div class="wf-pay" data-pay="xr" style="flex:1;padding:12px;border-radius:12px;border:2px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);text-align:center;cursor:pointer"><img src="assets/xrocket.jpg" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 4px"><span style="font-size:10px;font-weight:700;color:#fff">xRocket</span></div></div>' +
          '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Сумма (USDT)</div>' +
          '<input id="wfAmt" type="number" min="0.1" step="0.1" value="10" style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:#fff;font-size:17px;font-weight:700;outline:none;box-sizing:border-box">' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0 12px"><button class="wf-q" data-v="1" style="padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8);cursor:pointer;font-size:11px;font-weight:700">$1</button><button class="wf-q" data-v="5" style="padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8);cursor:pointer;font-size:11px;font-weight:700">$5</button><button class="wf-q" data-v="10" style="padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8);cursor:pointer;font-size:11px;font-weight:700">$10</button><button class="wf-q" data-v="25" style="padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8);cursor:pointer;font-size:11px;font-weight:700">$25</button><button class="wf-q" data-v="50" style="padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8);cursor:pointer;font-size:11px;font-weight:700">$50</button><button class="wf-q" data-v="100" style="padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8);cursor:pointer;font-size:11px;font-weight:700">$100</button></div>' +
          '<button id="wfDepBtn" style="width:100%;padding:14px;border-radius:12px;border:none;font-size:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#4caf50,#2e7d32);color:#fff">💳 Пополнить</button>' +
          '<div id="wfDepMsg" style="padding:10px;border-radius:10px;text-align:center;font-weight:600;font-size:12px;margin-top:8px;display:none"></div>' +
        '</div>' +
        '<div class="wf-p" data-p="wd" style="display:none">' +
          '<div style="text-align:center;padding:14px;background:rgba(0,0,0,0.2);border-radius:12px;margin-bottom:14px"><div style="font-size:11px;color:var(--muted)">Доступно к выводу</div><div style="font-size:28px;font-weight:900;color:#ffd700;margin-top:4px">$<span id="wfWdBal">0.00</span></div></div>' +
          '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Способ вывода</div>' +
          '<div style="display:flex;gap:8px;margin-bottom:12px"><div class="wf-mpay sel" data-mpay="cb" style="flex:1;padding:12px;border-radius:12px;border:2px solid #4caf50;background:rgba(76,175,80,0.12);text-align:center;cursor:pointer"><img src="assets/cryptobot.jpg" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 4px"><span style="font-size:10px;font-weight:700;color:#fff">CryptoBot</span></div><div class="wf-mpay" data-mpay="xr" style="flex:1;padding:12px;border-radius:12px;border:2px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);text-align:center;cursor:pointer"><img src="assets/xrocket.jpg" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 4px"><span style="font-size:10px;font-weight:700;color:#fff">xRocket</span></div></div>' +
          '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Сумма вывода (USDT)</div>' +
          '<input id="wfWdAmt" type="number" min="1.05" step="0.01" placeholder="Мин. $1.05" style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:#fff;font-size:17px;font-weight:700;outline:none;box-sizing:border-box">' +
          '<div style="font-size:18px;font-weight:900;color:#4caf50;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;margin:6px 0 10px;text-align:center">К получению: $<span id="wfRec">0.00</span> <span style="font-size:10px;color:var(--muted)">(комиссия 3%)</span></div>' +
          '<button id="wfWdBtn" disabled style="width:100%;padding:14px;border-radius:12px;border:none;font-size:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#2196f3,#1565c0);color:#fff;opacity:0.4">📤 Вывести</button>' +
          '<div style="font-size:10px;color:var(--muted);margin-top:6px;line-height:1.4">Мин. вывод $1.05 / Комиссия 3%</div>' +
          '<div id="wfWdMsg" style="padding:10px;border-radius:10px;text-align:center;font-weight:600;font-size:12px;margin-top:8px;display:none"></div>' +
        '</div>' +
        '<div class="wf-p" data-p="hist" style="display:none"><div id="wfTxList"><div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">История пуста</div></div></div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(wf);
  }

  var dd = document.getElementById('walletDrop');
  var wf = document.getElementById('walletFull');
  if (!dd || !wf) return;

  var payMethod = 'cb', wdPay = 'cb';

  function syncBal(){
    if (!window.Balance) return;
    var v = fmt(Balance.get());
    ['wdBal','wfDepBal','wfWdBal','hbal'].forEach(function(id){ var el=document.getElementById(id); if(el) el.textContent=v; });
    var uid = (window.Balance && window.Balance.getUserId()) || localStorage.getItem('tg_uid') || '';
    if(uid) {
      fetch('/api/wager/'+uid).then(function(r){return r.json();}).then(function(d){
        if(d.ok) {
          var wEl=document.getElementById('wdWager'); var wdEl=document.getElementById('wdWithdraw');
          if(wEl) wEl.textContent=d.wager_required.toFixed(2);
          if(wdEl){ wdEl.textContent=d.can_withdraw?'доступен':'отыграйте вагер'; wdEl.style.color=d.can_withdraw?'#4caf50':'#ff6b9d'; }
          var wfBtn=document.getElementById('wfWdBtn');
          if(wfBtn && d.can_withdraw){ wfBtn.disabled=false; wfBtn.style.opacity='1'; }
        }
      }).catch(function(){});
    }
  }

  function openDrop(){
    var rect = trigger.getBoundingClientRect();
    dd.style.top = (rect.bottom + 6) + 'px';
    dd.style.right = (window.innerWidth - rect.right) + 'px';
    dd.style.left = 'auto';
    dd.style.opacity = '1';
    dd.style.pointerEvents = 'auto';
    dd.style.transform = 'translateY(0)';
    trigger.classList.add('open');
    syncBal();
  }
  function closeDrop(){
    dd.style.opacity = '0';
    dd.style.pointerEvents = 'none';
    dd.style.transform = 'translateY(-8px)';
    trigger.classList.remove('open');
  }

  // Toggle dropdown on balance click
  trigger.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    if (dd.style.opacity==='1') closeDrop(); else openDrop();
  });

  // Close dropdown on outside click
  document.addEventListener('click', function(e){
    if (dd.style.opacity==='1' && !dd.contains(e.target) && e.target!==trigger) closeDrop();
  });

  // Open wallet fullscreen
  document.getElementById('wdOpen').addEventListener('click', function(e){
    e.stopPropagation(); closeDrop(); wf.style.display='flex'; syncBal();
  });

  // Close wallet
  document.getElementById('wfClose').addEventListener('click', function(){ wf.style.display='none'; });
  wf.addEventListener('click', function(e){ if(e.target===wf) wf.style.display='none'; });

  // Tabs
  wf.querySelectorAll('.wf-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      wf.querySelectorAll('.wf-tab').forEach(function(t){ t.classList.remove('active'); t.style.background='rgba(255,255,255,0.06)'; t.style.color='var(--muted)'; });
      tab.classList.add('active'); tab.style.background='linear-gradient(135deg,#ff6b9d,#ffd700)'; tab.style.color='#000';
      var t=tab.dataset.t; wf.querySelectorAll('.wf-p').forEach(function(p){ p.style.display=(p.dataset.p===t)?'block':'none'; });
      if(t==='hist') loadTx();
    });
  });

  // Pay methods
  wf.querySelectorAll('.wf-pay').forEach(function(el){
    el.addEventListener('click', function(){
      wf.querySelectorAll('.wf-pay').forEach(function(x){ x.classList.remove('sel'); x.style.borderColor='rgba(255,255,255,0.08)'; x.style.background='rgba(255,255,255,0.03)'; });
      el.classList.add('sel'); el.style.borderColor='#4caf50'; el.style.background='rgba(76,175,80,0.12)'; payMethod=el.dataset.pay;
    });
  });
  wf.querySelectorAll('.wf-mpay').forEach(function(el){
    el.addEventListener('click', function(){
      wf.querySelectorAll('.wf-mpay').forEach(function(x){ x.classList.remove('sel'); x.style.borderColor='rgba(255,255,255,0.08)'; x.style.background='rgba(255,255,255,0.03)'; });
      el.classList.add('sel'); el.style.borderColor='#4caf50'; el.style.background='rgba(76,175,80,0.12)'; wdPay=el.dataset.mpay;
    });
  });

  // Quick amounts
  wf.querySelectorAll('.wf-q').forEach(function(b){
    b.addEventListener('click', function(){ var inp=document.getElementById('wfAmt'); var cur=parseFloat(inp.value)||0; inp.value=Math.max(0.1,cur+parseFloat(b.dataset.v)).toFixed(2); });
  });

  // Withdraw input
  document.getElementById('wfWdAmt').addEventListener('input', function(){
    var v=parseFloat(this.value)||0; document.getElementById('wfRec').textContent=fmt(Math.max(0,v*0.97));
    var btn=document.getElementById('wfWdBtn'); btn.disabled=v<1.05; btn.style.opacity=v<1.05?'0.4':'1';
  });

  // Deposit
  document.getElementById('wfDepBtn').addEventListener('click', function(){
    var amt=parseFloat(document.getElementById('wfAmt').value)||0;
    if(amt<0.1){ sM('wfDepMsg','Мин. сумма $0.1','err'); return; }
    var btn=this; btn.disabled=true; btn.textContent='⏳...';
    var ep=payMethod==='xr'?'/api/invoice/xrocket':'/api/invoice';
    var uid=(window.Balance&&Balance.getUserId())||localStorage.getItem('tg_uid')||'';
    fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,amount:amt})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.ok&&d.payUrl){
        sM('wfDepMsg','✅ Счёт создан! Переход на оплату...','ok');
        if(window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.openLink)window.Telegram.WebApp.openLink(d.payUrl,{try_instant_view:false}); else window.location.href=d.payUrl;
        // Check invoice status every 3 seconds
        if(window._invChk) clearInterval(window._invChk);
        var _chkEp=payMethod==='xr'?'/api/invoice/check/xrocket':'/api/invoice/check';
window._invChk=setInterval(function(){
           fetch(_chkEp,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoiceId:d.invoiceId})})
           .then(function(r){return r.json();})
           .then(function(cd){
             if(cd.status==='paid'||cd.status==='completed'||cd.status==='success'){
               clearInterval(window._invChk);
               sM('wfDepMsg','✅ Оплачено! Баланс обновлён','ok');
               // Update balance via server
               fetch('/api/users?id='+uid).then(function(r){return r.json();}).then(function(ud){
                 if(ud.ok&&window.Balance) Balance.set(ud.balance);
                 syncBal();
               }).catch(function(){});
             }
           }).catch(function(){});
         },3000);
      }else{
        sM('wfDepMsg','Ошибка: '+(d.error||'unknown'),'err');
      }
    }).catch(function(){ sM('wfDepMsg','Ошибка сети','err'); })
    .finally(function(){ btn.disabled=false; btn.textContent='💳 Пополнить'; });
  });

  // Withdraw
  document.getElementById('wfWdBtn').addEventListener('click', function(){
    var amt=parseFloat(document.getElementById('wfWdAmt').value)||0;
    if(amt<1.05){ sM('wfWdMsg','Мин. вывод $1.05','err'); return; }
    var fee=Math.round(amt*0.03*100)/100;
    var curBal=window.Balance?Balance.get():0;
    if(amt>curBal){ sM('wfWdMsg','❌ Недостаточно средств','err'); return; }
    // Check wager
    var uid=(window.Balance&&Balance.getUserId())||localStorage.getItem('tg_uid')||'';
    if(uid) {
      fetch('/api/wager/'+uid).then(function(r){return r.json();}).then(function(wd){
        if(!wd.ok || !wd.can_withdraw){ sM('wfWdMsg','❌ Отыграйте вагер! Осталось: $'+wd.wager_required.toFixed(2),'err'); return; }
        doWithdraw(amt,fee,curBal);
      }).catch(function(){ sM('wfWdMsg','Ошибка проверки вагера','err'); });
    } else { doWithdraw(amt,fee,curBal); }
  });
  
  function doWithdraw(amt,fee,curBal){
    var btn=document.getElementById('wfWdBtn'); btn.disabled=true; btn.textContent='⏳...';
    var ep=wdPay==='xr'?'/api/withdraw/xrocket':'/api/withdraw/cryptobot';
    var uid=(window.Balance&&Balance.getUserId())||localStorage.getItem('tg_uid')||'';
    fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,amount:amt})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.ok){ if(window.Balance)Balance.set(curBal-amt); sM('wfWdMsg','✅ Вывод $'+fmt(amt)+' выполнен! Комиссия 3% ($'+fmt(fee)+'). К получению: $'+fmt(d.received),'ok'); syncBal(); }
      else sM('wfWdMsg','❌ Ошибка: '+(typeof d.error==='string'?d.error:JSON.stringify(d.error)),'err');
    }).catch(function(){ sM('wfWdMsg','Ошибка сети','err'); })
    .finally(function(){ btn.disabled=false; btn.textContent='📤 Вывести'; });
  }

  function sM(id,t,y){ var el=document.getElementById(id); if(!el)return; el.textContent=t; el.style.display='block'; el.style.background=y==='ok'?'rgba(76,175,80,0.15)':'rgba(244,67,54,0.15)'; el.style.color=y==='ok'?'#4caf50':'#f44336'; }

  function loadTx(){
    var el=document.getElementById('wfTxList'); if(!el)return;
    el.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">Загрузка...</div>';
    var uid=(window.Balance&&Balance.getUserId())||localStorage.getItem('tg_uid')||'';
    if(!uid){ el.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">История пуста</div>'; return; }
    fetch('/api/transactions/'+uid)
      .then(function(r){return r.json();})
      .then(function(d){
        if(!d.ok||!d.transactions||d.transactions.length===0){ el.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">История пуста</div>'; return; }
        el.innerHTML='';
        d.transactions.forEach(function(tx){
          var row=document.createElement('div'); row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:9px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px';
          var isDep=tx.type==='deposit', isPromo=tx.type==='promo', isWd=tx.type==='withdraw';
          var label, clr, sign;
          if(isDep){ label='📥 Пополнение'; clr='#4caf50'; sign='+'; }
          else if(isPromo){ label='🎟 Промокод'; clr='#4caf50'; sign='+'; }
          else if(isWd){ label='📤 Вывод'; clr='#f44336'; sign='-'; }
          else if(tx.type==='win'){ label='🏆 Выигрыш'; clr='#4caf50'; sign='+'; }
          else if(tx.type==='bet'){ label='🎰 Ставка'; clr='#f44336'; sign='-'; }
          else{ label='📋 '+tx.type; clr='rgba(255,255,255,0.5)'; sign=''; }
          row.innerHTML='<div><div style="font-size:12px;font-weight:700;color:#fff">'+label+'</div><div style="font-size:10px;color:var(--muted)">'+new Date(tx.time||tx.date).toLocaleDateString('ru')+'</div></div><div style="font-size:13px;font-weight:800;color:'+clr+'">'+sign+'$'+Number(tx.amount).toFixed(2)+'</div>';
          el.appendChild(row);
        });
      })
      .catch(function(){ el.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">Ошибка загрузки</div>'; });
  }
})();
