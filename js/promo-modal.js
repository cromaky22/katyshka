(function(){
  if(!document.getElementById('promoModal')){
    var pm = document.createElement('div');
    pm.className = 'promo-modal';
    pm.id = 'promoModal';
    pm.setAttribute('aria-hidden','true');
    pm.style.display = 'none';
    pm.innerHTML = '<div class="promo-card"><button class="promo-close" id="promoClose" aria-label="Close">✕</button><div class="promo-illustration"><img src="assets/promo_card.png" alt="promo" onerror="this.style.display=\'none\'"></div><h3>Активируй промокод и получи бонус</h3><p class="promo-sub">Введите код</p><input id="promoCodeInput" class="promo-input" placeholder="katyshka" maxlength="40"><div class="promo-actions"><button id="promoActivate" class="btn">Активировать</button></div><div id="promoMessage" class="promo-message" aria-live="polite"></div></div>';
    document.body.appendChild(pm);
  }

  function normalizeCode(s){ return (s||'').replace(/[^A-Z0-9]/ig,'').toUpperCase(); }

  var promoButtons = document.querySelectorAll('[data-action="promo"]');
  var promoModal = document.getElementById('promoModal');
  var promoInput = document.getElementById('promoCodeInput');
  var promoActivate = document.getElementById('promoActivate');
  var promoClose = document.getElementById('promoClose');
  var promoMessage = document.getElementById('promoMessage');

  function openModal(){
    if(!promoModal) return;
    promoModal.style.display = '';
    promoModal.setAttribute('aria-hidden','false');
    promoMessage.textContent='';
    if(promoInput) { promoInput.value=''; promoInput.focus(); }
  }
  function closeModal(){
    if(!promoModal) return;
    promoModal.style.display = 'none';
    promoModal.setAttribute('aria-hidden','true');
    if(promoActivate) promoActivate.disabled = false;
    if(promoInput) promoInput.disabled = false;
  }

  promoButtons.forEach(function(b){ b.addEventListener('click', function(e){ e.preventDefault(); openModal(); }); });
  if(promoClose) promoClose.addEventListener('click', closeModal);
  if(promoModal) promoModal.addEventListener('click', function(e){ if(e.target === promoModal) closeModal(); });

  function showMessage(msg, success){
    if(!promoMessage) return;
    promoMessage.textContent = msg;
    promoMessage.style.color = success ? 'var(--accent-green)' : '#ff6b6b';
  }

  if(promoActivate){
    function attemptActivate(rawCode){
      var code = normalizeCode(rawCode);
      if(!code){ showMessage('Введите код', false); return false; }
      var userId = window.Balance ? Balance.getUserId() : null;
      if(!userId){ showMessage('❌ Ошибка авторизации', false); return false; }

      fetch('/api/promos/' + encodeURIComponent(code) + '/activate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: userId})
      })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d.error){
          var ruErrors = {
            'Promo not found': 'Промокод не найден',
            'Already activated': 'Промокод уже активирован',
            'Promo limit reached': 'Достигнут лимит активаций'
          };
          showMessage('❌ ' + (ruErrors[d.error] || d.error), false);
          return;
        }
        if(window.Balance) Balance.sync(d.balance);
        if(window.mcStats) mcStats.addPromo(d.amount, code);
        showMessage('✅ Промокод активирован! +$' + Number(d.amount).toFixed(2), true);
        promoActivate.disabled = true;
        promoInput.disabled = true;
        setTimeout(function(){ closeModal(); }, 1500);
      })
      .catch(function(){ showMessage('❌ Ошибка сети', false); });
      return true;
    }

    promoActivate.addEventListener('click', function(){
      var raw = promoInput ? promoInput.value.trim() : '';
      attemptActivate(raw);
    });

    if(promoInput) {
      promoInput.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){ e.preventDefault(); promoActivate.click(); }
      });
    }
  }
})();
