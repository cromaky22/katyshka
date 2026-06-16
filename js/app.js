// Общий скрипт для навигации и splash
(function(){
  // redirect from splash
  if(document.body.classList.contains('splash')){
    setTimeout(()=>{location.href='home.html'},1200);
    return;
  }

  // === Stats & History helpers ===
  window.mcStats = {
    addBet: function(amount, game, detail){
      amount = Math.abs(parseFloat(amount)||0);
      if(amount <= 0) return;
      var games = parseInt(localStorage.getItem('mc_games_played')||'0') + 1;
      var bets = parseFloat(localStorage.getItem('mc_total_bets')||'0') + amount;
      localStorage.setItem('mc_games_played', games);
      localStorage.setItem('mc_total_bets', bets.toFixed(2));
      this._addHistory('bet', amount, game, detail);
    },
    addWin: function(amount, game, detail){
      amount = Math.abs(parseFloat(amount)||0);
      if(amount <= 0) return;
      var wins = parseInt(localStorage.getItem('mc_wins_count')||'0') + 1;
      var totalWin = parseFloat(localStorage.getItem('mc_total_win_amount')||'0') + amount;
      var maxWin = parseFloat(localStorage.getItem('mc_max_win')||'0');
      if(amount > maxWin) maxWin = amount;
      localStorage.setItem('mc_wins_count', wins);
      localStorage.setItem('mc_total_win_amount', totalWin.toFixed(2));
      localStorage.setItem('mc_max_win', maxWin.toFixed(2));
      this._addHistory('win', amount, game, detail);
    },
    addLoss: function(amount, game, detail){
      amount = Math.abs(parseFloat(amount)||0);
      var losses = parseInt(localStorage.getItem('mc_losses_count')||'0') + 1;
      localStorage.setItem('mc_losses_count', losses);
      this._addHistory('loss', amount, game, detail);
    },
    addDeposit: function(amount, detail){
      amount = Math.abs(parseFloat(amount)||0);
      var total = parseFloat(localStorage.getItem('mc_deposits_total')||'0') + amount;
      localStorage.setItem('mc_deposits_total', total.toFixed(2));
      this._addHistory('deposit', amount, null, detail);
    },
    addWithdraw: function(amount, detail){
      amount = Math.abs(parseFloat(amount)||0);
      var total = parseFloat(localStorage.getItem('mc_withdraws_total')||'0') + amount;
      localStorage.setItem('mc_withdraws_total', total.toFixed(2));
      this._addHistory('withdraw', amount, null, detail);
    },
    addPromo: function(amount, code){
      amount = Math.abs(parseFloat(amount)||0);
      var total = parseFloat(localStorage.getItem('mc_deposits_total')||'0') + amount;
      localStorage.setItem('mc_deposits_total', total.toFixed(2));
      this._addHistory('promo', amount, null, 'Код: ' + code);
    },
    _addHistory: function(type, amount, game, detail){
      try{
        var history = JSON.parse(localStorage.getItem('mc_history')||'[]');
        history.push({ type:type, amount:amount, game:game||null, detail:detail||null, time:Date.now() });
        if(history.length > 200) history = history.slice(-200);
        localStorage.setItem('mc_history', JSON.stringify(history));
      }catch(e){}
    }
  };

  // Initialize activation system (max 10 activations)
  (function(){
    const MAX_ACTIVATIONS = 10;
    let activations = parseInt(localStorage.getItem('mc_activations') || '0');
    
    if(activations < MAX_ACTIVATIONS){
      activations++;
      localStorage.setItem('mc_activations', activations.toString());
    }
    
    // Store activation info for debugging
    localStorage.setItem('mc_last_activation', new Date().toISOString());
    localStorage.setItem('mc_activation_count', activations.toString());
  })();

  // highlight active nav item and handle hash navigation
  (function(){
    function updateActive(){
      const path = location.pathname.split('/').pop() || 'home.html';
      const hash = (location.hash || '').replace('#','');
      const nameFromPath = path === 'home.html' ? '' : path.replace('.html','');
      const activeName = hash || nameFromPath;
      document.querySelectorAll('.bottom-nav .nav-item').forEach(a=>{
        if(a.dataset.name===activeName) a.classList.add('active');
        else a.classList.remove('active');
      });
      // Always highlight center button on home
      if(path === 'home.html' && !hash){
        document.querySelectorAll('.bottom-nav .nav-item').forEach(a=>a.classList.remove('active'));
        const centerBtn = document.querySelector('.bottom-nav .nav-item.center');
        if(centerBtn) centerBtn.classList.add('active');
      }
    }

      // Games search: filter tiles and highlight matches
      (function(){
        const input = document.getElementById('gameSearch');
        const grid = document.querySelector('.games-grid');
        if(!input || !grid) return;

        const tiles = Array.from(grid.querySelectorAll('.game-tile'));

        function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
        function highlight(text, q){
          if(!q) return text;
          const re = new RegExp('(' + escapeRegExp(q) + ')', 'ig');
          return text.replace(re, '<mark class="game-match">$1</mark>');
        }

        let emptyEl = document.querySelector('.games-empty');
        if(!emptyEl){
          emptyEl = document.createElement('div');
          emptyEl.className = 'games-empty';
          emptyEl.textContent = 'Ничего не найдено';
          emptyEl.style.display = 'none';
          const section = document.getElementById('games');
          if(section) section.appendChild(emptyEl);
        }

        input.addEventListener('input', ()=>{
          const q = input.value.trim().toLowerCase();
          let any = false;
          tiles.forEach(tile => {
            const nameEl = tile.querySelector('.game-name');
            const name = nameEl && nameEl.textContent ? nameEl.textContent.trim() : '';
            if(!q){
              tile.style.display = '';
              // remove highlights
              if(nameEl) nameEl.innerHTML = name;
              any = true;
              return;
            }
            if(name.toLowerCase().includes(q)){
              tile.style.display = '';
              if(nameEl) nameEl.innerHTML = highlight(name, q);
              any = true;
            } else {
              tile.style.display = 'none';
              // remove highlights
              if(nameEl) nameEl.innerHTML = name;
            }
          });
          emptyEl.style.display = any ? 'none' : '';
        });
      })();
    function scrollToHash(){
      const path = location.pathname.split('/').pop() || 'home.html';
      const hash = (location.hash || '').replace('#','');
      if(hash && path === 'home.html'){
        const el = document.getElementById(hash);
        if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),120);
      }
    }

    // Initial update
    updateActive();
    scrollToHash();

    // Update on hashchange
    window.addEventListener('hashchange', ()=>{ updateActive(); scrollToHash(); });

    // Also update on clicks of nav items without full reload (same-page links)
    document.querySelectorAll('.bottom-nav .nav-item').forEach(a=>{
      a.addEventListener('click', (e)=>{
        const href = a.getAttribute('href') || '';
        // if link is same-page anchor (home.html#...) or just #..., let browser change hash and handle it
        if(href.includes('#')){
          // if link points to home.html#games but we're already on home, prevent full navigation and set hash
          const current = location.pathname.split('/').pop() || 'home.html';
          const targetPath = href.split('#')[0] || 'home.html';
          const targetHash = href.split('#')[1] || '';
          if((targetPath === '' || targetPath === current) && targetHash){
            e.preventDefault();
            location.hash = targetHash;
            // update immediately
            updateActive();
            scrollToHash();
          }
        }
      });
    });
  })();
  // Balance module auto-initializes from balance.js on DOMContentLoaded

  // Promo modal & activation logic
  (function(){
    // Inject promo modal into DOM if missing
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

    const promoButtons = document.querySelectorAll('[data-action="promo"]');
    const promoModal = document.getElementById('promoModal');
    const promoInput = document.getElementById('promoCodeInput');
    const promoActivate = document.getElementById('promoActivate');
    const promoClose = document.getElementById('promoClose');
    const promoMessage = document.getElementById('promoMessage');

    function updateBalanceDisplay(newVal){
      if(window.Balance) Balance.set(newVal);
    }

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

    promoButtons.forEach(b=> b.addEventListener('click', (e)=>{ e.preventDefault(); openModal(); }));
    if(promoClose) promoClose.addEventListener('click', closeModal);
    if(promoModal) promoModal.addEventListener('click', (e)=>{ if(e.target === promoModal) closeModal(); });

    function showMessage(msg, success){ 
      if(!promoMessage) return; 
      promoMessage.textContent = msg; 
      promoMessage.style.color = success ? 'var(--accent-green)' : '#ff6b6b';
    }

    if(promoActivate){
      function attemptActivate(rawCode){
        const code = normalizeCode(rawCode);
        if(!code){ 
          showMessage('Введите код', false); 
          return false;
        }
        const userId = Balance.getUserId();
        if(!userId){ 
          showMessage('❌ Ошибка авторизации', false); 
          return false;
        }
        
        // Request server to activate promo
        fetch('/api/promos/' + encodeURIComponent(code) + '/activate', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: userId})
        })
        .then(function(r){ return r.json(); })
        .then(function(d){
          if(d.error){
            showMessage('❌ ' + d.error, false);
            return;
          }
          Balance.sync(d.balance);
          if(window.mcStats) mcStats.addPromo(d.amount, code);
          showMessage('✅ Промокод активирован! +$' + Number(d.amount).toFixed(2), true);
          promoActivate.disabled = true;
          promoInput.disabled = true;
          setTimeout(function(){ closeModal(); }, 1500);
        })
        .catch(function(){
          showMessage('❌ Ошибка сети', false);
        });
        return true;
      }
       
      promoActivate.addEventListener('click', ()=>{
        const raw = promoInput ? promoInput.value.trim() : '';
        attemptActivate(raw);
      });
      
      if(promoInput) {
        promoInput.addEventListener('keydown', (e)=>{ 
          if(e.key === 'Enter'){ 
            e.preventDefault();
            promoActivate.click(); 
          } 
        });
      }
    }
  })();

  // simple auto-scrolling carousel for empty promo cards
  (function(){
    const carousel = document.getElementById('mainCarousel');
    if(!carousel) return;
    let cards = carousel.querySelectorAll('.card');
    if(!cards.length) return;
    // original count (we won't clone; keep only original cards)
    const originalCount = cards.length;

    const gap = parseInt(getComputedStyle(carousel).gap || 12);
    function getStep(){
      const card = carousel.querySelector('.card');
      return (card ? card.offsetWidth : 200) + gap;
    }

    // dots
    const dotsContainer = document.getElementById('carouselDots');
    if(dotsContainer){
      dotsContainer.innerHTML = '';
      for(let i=0;i<originalCount;i++){
        const d = document.createElement('button');
        d.className = 'dot';
        d.dataset.index = i;
        d.type = 'button';
        d.addEventListener('click', ()=>{
          // scroll to card i
          const step = getStep();
          carousel.scrollTo({left: i * step, behavior: 'smooth'});
          updateDots(i);
        });
        dotsContainer.appendChild(d);
      }
    }

    function updateDots(activeIdx){
      if(!dotsContainer) return;
      dotsContainer.querySelectorAll('.dot').forEach((dot,idx)=>{
        dot.classList.toggle('active', idx===activeIdx);
      });
    }

    // initial dot state
    updateDots(0);

    let pos = 0;
    const step = getStep();
    const delay = 2200;
    let anim;
    function tick(){
      pos += step;
      if(pos > carousel.scrollWidth - carousel.clientWidth + step/2){
        // smooth reset back to 0
        carousel.scrollTo({left:0,behavior:'smooth'});
        pos = 0;
      } else {
        carousel.scrollTo({left:pos,behavior:'smooth'});
      }
      // update active dot based on current pos
      const idx = Math.round((carousel.scrollLeft || pos) / step) % originalCount;
      updateDots(idx);
    }
    anim = setInterval(tick, delay);
    // pause on hover / pointerdown
    ['pointerenter','pointerdown'].forEach(ev=>carousel.addEventListener(ev, ()=>clearInterval(anim)));
    ['pointerleave','pointerup'].forEach(ev=>carousel.addEventListener(ev, ()=>{anim = setInterval(tick, delay)}));
    // update dots on user scroll
    carousel.addEventListener('scroll', ()=>{
      const idx = Math.round(carousel.scrollLeft / step) % originalCount;
      updateDots(idx);
    });
  })();

  // chips active behavior
  (function(){
    const chips = document.querySelectorAll('.chip');
    if(!chips.length) return;
    chips.forEach(ch => {
      ch.addEventListener('click', ()=> {
        // single-active behaviour
        chips.forEach(c=> c.classList.remove('active'));
        ch.classList.add('active');
      });
      ch.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          ch.click();
        }
      });
    });
  })();

  // Page loader overlay: inject DOM node and handle navigation transitions
  (function(){
    // create loader element (ring of hearts + text)
    const loader = document.createElement('div');
    loader.className = 'page-loader';
     loader.innerHTML = '<div class="loader-box"><div class="loader-ring" id="loaderRing" aria-hidden="true"></div><div class="loader-text" id="loaderText">ЗАГРУЗКА...</div></div>';
     document.body.appendChild(loader);

     // Simple spinner — pure CSS, no hearts needed

     function showLoader(text, mode){
      const t = document.getElementById('loaderText');
      if(t && text) t.textContent = text;
      loader.classList.remove('startup','nav');
      if(mode) loader.classList.add(mode);
      loader.classList.add('active');
    }
    function hideLoader(){ loader.classList.remove('active'); loader.classList.remove('startup','nav'); }

    // show startup loader on first entry to games page only
    try{
      const path = location.pathname.split('/').pop() || 'home.html';
      const isGames = path === 'games.html' || location.hash.replace('#','') === 'games' || !!document.getElementById('games');
      if(isGames && !sessionStorage.getItem('startupLoaderShown')){
        sessionStorage.setItem('startupLoaderShown','1');
        showLoader('ЗАГРУЗКА...', 'startup');
        // удлиним показ стартового лоадера на 2 секунды
        setTimeout(hideLoader, 3400);
      }
    }catch(e){/*ignore*/}

    // Intercept bottom-nav and top nav clicks to show loader before navigation
    document.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click', (e)=>{
        const href = a.getAttribute('href') || '';
        // ignore anchors that are just hashes or on-page links
        if(href.startsWith('#') || href === '' ) return;
        // don't show loader for menu action buttons or elements opting out
        if(a.closest && a.closest('.menu-actions')) return;
        if(a.classList && (a.classList.contains('no-loader') || a.dataset && a.dataset.noLoader)) return;
        // allow in-page hash navigation without loader when target is same page
        const current = location.pathname.split('/').pop() || 'home.html';
        const targetPath = href.split('#')[0] || '';
        if(targetPath === '' || targetPath === current) return;
        // otherwise show loader and navigate after a slightly longer delay
        e.preventDefault();
        showLoader('ЗАГРУЖАЕМ…', 'nav');
        // устанавливаем задержку перехода в 1000ms
        setTimeout(()=>{ location.href = href; }, 1000);
      });
    });

  })();
})();

// Profile dropdown
(function(){
  const btn = document.getElementById('profileBtn');
  const dd = document.getElementById('profileDropdown');
  const overlay = document.getElementById('pdOverlay');
  const pdUserId = document.getElementById('pdUserId');
  const pdPromoBtn = document.getElementById('pdPromoBtn');
  if(!btn || !dd) return;

  function getId(){
    try{
      const tg = window.Telegram && window.Telegram.WebApp;
      const candidates = [
        tg && tg.initDataUnsafe && tg.initDataUnsafe.user,
        tg && tg.initDataUnsafe && tg.initDataUnsafe.receiver,
        tg && tg.user
      ];
      for (const user of candidates) {
        if (user && user.id) return String(user.id);
      }
    }catch(e){}
    return localStorage.getItem('tg_uid') || '—';
  }

  function syncId(){
    if(pdUserId) pdUserId.textContent = getId();
  }

  function close(){ dd.classList.remove('open'); if(overlay) overlay.classList.remove('open'); }
  function open(){ syncId(); dd.classList.add('open'); if(overlay) overlay.classList.add('open'); }

  syncId();

  btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); dd.classList.contains('open') ? close() : open(); });
  if(overlay) overlay.addEventListener('click', close);

  if(pdPromoBtn){
    pdPromoBtn.addEventListener('click', function(){
      close();
      const modal = document.getElementById('promoModal');
      const input = document.getElementById('promoCodeInput');
      if(modal){ modal.style.display = ''; modal.setAttribute('aria-hidden','false'); }
      if(input) input.focus();
    });
  }
})();

// Populate recipient info from Telegram WebApp when available
(function(){
  // CSS diagnostic: log any stylesheet access errors to console
  try{
    setTimeout(()=>{
      Array.from(document.styleSheets).forEach((ss)=>{
        try{
          // accessing cssRules may throw for cross-origin or parse errors
          const rules = ss.cssRules && ss.cssRules.length;
          console.log('Stylesheet loaded:', ss.href || '[inline]', 'rules:', rules);
        }catch(e){
          console.error('Stylesheet access error for', ss.href || '[inline]', e && e.message);
        }
      });
    }, 300);
  }catch(e){}
  try{
    const nameEl = document.querySelector('.recipient-name');
    const subEl = document.querySelector('.recipient-sub');
    function fillFromUser(user){
      if(!user) return false;
      console.log('📷 Telegram user data:', user);
      if(nameEl) nameEl.textContent = (user.username) || ((user.first_name||'') + (user.last_name ? (' ' + user.last_name) : '') ).trim() || '';
      if(subEl) subEl.textContent = 'Telegram ID ' + (user.id || '');
      // set header profile image if available
      try{
        const profileImg = document.querySelector('.app-header .profile img');
        const profileBtn = document.querySelector('.app-header .profile');
        if(profileImg && profileBtn){
          const candidate = user.photo_url || user.avatar;
          console.log('🖼️ Avatar URL:', candidate);
          if(candidate){
            profileImg.src = candidate;
            profileImg.style.display = '';
            console.log('✅ Avatar set to:', candidate);
            profileImg.onerror = function(){ console.warn('❌ Avatar failed to load'); this.style.display = 'none'; };
          } else if(user.id) {
            // Try to load avatar from Telegram API
            fetch('/api/tg-photo/' + user.id)
              .then(res => {
                if(res.ok) return res.blob();
                throw new Error('No photo');
              })
              .then(blob => {
                const url = URL.createObjectURL(blob);
                profileImg.src = url;
                profileImg.style.display = '';
                console.log('✅ Avatar loaded from API');
              })
              .catch(() => {
                // Show initials as fallback
                const name = user.username || (user.first_name || '') + (user.last_name ? ' ' + user.last_name : '');
                const initials = name.trim() ? name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
                profileImg.style.display = 'none';
                let initialsEl = profileBtn.querySelector('.avatar-initials');
                if (!initialsEl) {
                  initialsEl = document.createElement('div');
                  initialsEl.className = 'avatar-initials';
                  profileBtn.appendChild(initialsEl);
                }
                initialsEl.textContent = initials;
                initialsEl.style.display = 'flex';
              });
          }
        }
      }catch(e){ console.error('❌ Error setting avatar:', e); }
      // save locally for offline fallback
      try{ localStorage.setItem('tg_user', JSON.stringify(user)); }catch(e){}
      // try send to local API (if server running)
      try{
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            username: user.username || null,
            avatar: user.photo_url || user.avatar || null
          })
        }).then(res => res.json()).then(data => {
          // Balance will be loaded by Balance.init()
          console.log('✅ User registered:', user.id);
        }).catch(()=>{});
      }catch(e){}
      return true;
    }

    function tryFill(){
      try{
        const tg = window.Telegram && window.Telegram.WebApp;
        console.log('🔍 Checking Telegram WebApp:', !!tg);
        if(tg){
          console.log('✅ Telegram WebApp found');
          const u1 = tg.initDataUnsafe && tg.initDataUnsafe.user;
          console.log('📱 Try 1 - initDataUnsafe.user:', u1);
          if(fillFromUser(u1)) return;
          const u2 = tg.initData && tg.initData.user;
          console.log('📱 Try 2 - initData.user:', u2);
          if(fillFromUser(u2)) return;
          const u3 = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.user;
          console.log('📱 Try 3 - WebApp.user:', u3);
          if(fillFromUser(u3)) return;
          console.log('⚠️ No user data found in Telegram WebApp');
        } else {
          console.log('⚠️ Telegram WebApp not available (normal in browser, works in Telegram)');
        }
        if(window.__tg_user){ console.log('💾 Found __tg_user:', window.__tg_user); fillFromUser(window.__tg_user); return }
        try{
          const maybe = localStorage.getItem('tg_user') || localStorage.getItem('mc_user') || localStorage.getItem('user');
          if(maybe){
            console.log('💾 Found saved user in localStorage');
            let parsed = null;
            try{ parsed = JSON.parse(maybe); }catch(e){}
            if(parsed) { fillFromUser(parsed); return }
          }
        }catch(e){ console.error('❌ localStorage error:', e); }
      }catch(e){ console.error('❌ tryFill error:', e); }
    }

    // Initialize Telegram WebApp
    try{
      const tg = window.Telegram && window.Telegram.WebApp;
      if(tg){
        tg.ready();
        tg.expand();
        console.log('✅ Telegram WebApp initialized');
      }
    }catch(e){ console.error('❌ WebApp init error:', e); }

    // attempt multiple times in case WebApp initializes slightly later
    console.log('🚀 Starting Telegram user detection...');
    tryFill();
    let attempts = 0;
    const t = setInterval(()=>{ attempts++; if(attempts<=6) { console.log(`🔄 Retry ${attempts}...`); tryFill(); } if(attempts>=6) clearInterval(t); }, 500);
  }catch(e){
    // ignore if WebApp not present
  }
})();

// Wallet UI interactions
(function(){
  const modal = document.querySelector('.wallet-modal');
  if(!modal) return;

  // tabs
  function showPanel(name){
    modal.querySelectorAll('.panel').forEach(p=>{ p.style.display = (p.dataset.panel===name) ? '' : 'none' });
  }

  modal.querySelectorAll('.wallet-tabs .tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      modal.querySelectorAll('.wallet-tabs .tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.target || tab.textContent.trim().toLowerCase();
      showPanel(target);
    });
  });

  // initial panels
  showPanel('topup');

  // close
  const closeBtn = modal.querySelector('.close-modal');
  if(closeBtn) closeBtn.addEventListener('click', ()=>{ modal.style.display='none' });

  // methods
  modal.querySelectorAll('.method').forEach(m=>{
    m.addEventListener('click', ()=>{
      modal.querySelectorAll('.method').forEach(x=>x.classList.remove('selected'));
      m.classList.add('selected');
    });
  });

  // quick amount buttons
  const amountInput = modal.querySelector('.amount-input input');
  modal.querySelectorAll('.quick-buttons .chip').forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = parseFloat(b.textContent.replace('$','').trim()) || 0;
      amountInput.value = v.toFixed(0);
    });
  });

  // pay button (placeholder)
  const pay = modal.querySelector('.pay-btn');
  if(pay) pay.addEventListener('click', ()=>{
    const val = parseFloat(amountInput.value)||0;
    if(val <= 0){ alert('Введите сумму пополнения'); return; }
    alert('Перейти к оплате: $' + val);
  });

  // history sub-tabs
  modal.querySelectorAll('.history-tab').forEach(ht=>{
    ht.addEventListener('click', ()=>{
      modal.querySelectorAll('.history-tab').forEach(h=>h.classList.remove('active'));
      ht.classList.add('active');
      const target = ht.dataset.h;
      modal.querySelectorAll('.history-panel').forEach(p=>{ p.style.display = (p.dataset.hpanel===target) ? '' : 'none' });
    });
  });

  // Withdraw calculations
  (function(){
    const withdrawInput = modal.querySelector('.withdraw-input');
    const receiveAmountEl = modal.querySelector('.receive-amount .amount');
    const commissionValueEl = modal.querySelector('.commission-value');
    const commissionRateEl = modal.querySelector('.commission-rate');
    const minAmountEl = modal.querySelector('.min-amount');
    const withdrawBtn = modal.querySelector('.withdraw-btn');

    const COMM_RATE = parseFloat((commissionRateEl && commissionRateEl.textContent) ? commissionRateEl.textContent.replace('%','') : 3) / 100;
    const MIN_WITHDRAW = parseFloat((minAmountEl && minAmountEl.textContent) ? minAmountEl.textContent.replace('$','') : 1.05);

    function format(n){ return Number(n).toFixed(2) }

    function update(){
      const val = parseFloat(withdrawInput.value) || 0;
      const fee = +(val * COMM_RATE);
      const received = Math.max(0, val - fee);
      receiveAmountEl.textContent = format(received);
      commissionValueEl.textContent = format(fee);
      // disable button if below min
      if(withdrawBtn){
        if(val < MIN_WITHDRAW) withdrawBtn.disabled = true;
        else withdrawBtn.disabled = false;
      }
    }

    if(withdrawInput){
      withdrawInput.addEventListener('input', update);
      // initialize
      update();
    }
  })();
})();

// Background floating stars
(function(){
  const MAX = 40;
  const spawnInterval = 600;
  const containerClass = 'bg-stars';
  
  let container = document.querySelector('.' + containerClass);
  if(!container){
    container = document.createElement('div');
    container.className = 'bg-stars';
    document.body.prepend(container);
  }

  function rand(min, max){ return Math.random() * (max - min) + min }

  function createStar(){
    if(container.children.length > MAX) return;
    const s = document.createElement('span');
    s.className = 'bg-star';
    s.innerHTML = '&#10022;'; // ✦ star symbol
    const size = Math.round(rand(10,22));
    const left = Math.round(rand(2,98));
    const dur = (rand(5,12)).toFixed(2) + 's';
    s.style.fontSize = size + 'px';
    s.style.left = left + '%';
    s.style.animationDuration = dur;
    s.style.opacity = (rand(0.5,1)).toFixed(2);
    container.appendChild(s);
    setTimeout(()=>{ if(s && s.parentNode) s.parentNode.removeChild(s) }, (parseFloat(dur) * 1000) + 500);
  }

  for(let i=0;i<8;i++) setTimeout(createStar, i*150);
  const handle = setInterval(createStar, spawnInterval);
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) clearInterval(handle);
  });
})();


