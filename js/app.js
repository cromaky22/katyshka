// Общий скрипт для навигации и splash
(function(){
  // redirect from splash
  if(document.body.classList.contains('splash')){
    setTimeout(()=>{location.href='home.html'},1200);
    return;
  }

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
    }

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
  // populate balance fields
  const balanceElems = document.querySelectorAll('.balance-value');
  const stored = localStorage.getItem('mc_balance');
  const balance = stored !== null ? parseFloat(stored).toFixed(2) : '0.00';
  balanceElems.forEach(el=>el.textContent = balance);

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
})();

// Populate recipient info from Telegram WebApp when available
(function(){
  try{
    const nameEl = document.querySelector('.recipient-name');
    const subEl = document.querySelector('.recipient-sub');
    // debug banner to show detection status on mobile
    function ensureDebugBanner(){
      if(document.getElementById('tg-debug-banner')) return;
      const b = document.createElement('div');
      b.id = 'tg-debug-banner';
      b.style.position = 'fixed';
      b.style.left = '8px';
      b.style.right = '8px';
      b.style.bottom = '86px';
      b.style.zIndex = 9999;
      b.style.background = 'rgba(0,0,0,0.5)';
      b.style.color = '#fff';
      b.style.fontSize = '12px';
      b.style.padding = '8px';
      b.style.borderRadius = '8px';
      b.style.textAlign = 'center';
      b.style.pointerEvents = 'none';
      b.textContent = 'TG debug: initializing...';
      document.body.appendChild(b);
    }
    function setDebug(msg){ const b = document.getElementById('tg-debug-banner'); if(b) b.textContent = 'TG debug: ' + msg; }
    function fillFromUser(user){
      if(!user) return false;
      if(nameEl) nameEl.textContent = ((user.first_name||'') + (user.last_name ? (' ' + user.last_name) : '') ).trim() || (user.username || '');
      if(subEl) subEl.textContent = 'Telegram ID ' + (user.id || '');
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
        }).catch(()=>{});
      }catch(e){}
      setDebug('filled: ' + ((user.username || user.first_name || '') + ' / ' + (user.id||'')));
      return true;
    }

    function tryFill(){
      ensureDebugBanner();
      setDebug('searching...');
      try{
        const tg = window.Telegram && window.Telegram.WebApp;
        if(tg){
          setDebug('Telegram.WebApp present');
          // try several common locations
          const u1 = tg.initDataUnsafe && tg.initDataUnsafe.user;
          if(u1){ setDebug('found initDataUnsafe.user'); if(fillFromUser(u1)) return; }
          const u2 = tg.initData && tg.initData.user;
          if(u2){ setDebug('found initData.user'); if(fillFromUser(u2)) return; }
          const u3 = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.user;
          if(u3){ setDebug('found WebApp.user'); if(fillFromUser(u3)) return; }
        } else {
          setDebug('Telegram.WebApp not present');
        }
        // fallback: try global initData parse (if available)
        if(window.__tg_user){ setDebug('found __tg_user'); fillFromUser(window.__tg_user); return }
        // additional fallback: try reading saved user from localStorage
        try{
          const maybe = localStorage.getItem('tg_user') || localStorage.getItem('mc_user') || localStorage.getItem('user');
          if(maybe){
            let parsed = null;
            try{ parsed = JSON.parse(maybe); }catch(e){}
            if(parsed) { setDebug('found localStorage user'); fillFromUser(parsed); return }
          }
        }catch(e){}
        // final attempt: if local id stored, GET from local API
        try{
          const saved = localStorage.getItem('tg_user');
          if(saved){
            const parsed = JSON.parse(saved);
            if(parsed && parsed.id){
              fetch('/api/users/' + parsed.id).then(r=>r.json()).then(data=>{ if(data && data.id) { setDebug('fetched from API'); fillFromUser(data); } }).catch(()=>{});
            }
          }
        }catch(e){}
      }catch(e){ setDebug('error during tryFill'); }
    }

    // attempt multiple times in case WebApp initializes slightly later
    tryFill();
    let attempts = 0;
    const t = setInterval(()=>{ attempts++; tryFill(); if(attempts>12) clearInterval(t); }, 500);

    // re-run tryFill when user navigates or opens wallet links
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) tryFill(); });
    // click handlers for common wallet links/buttons
    document.querySelectorAll('a[href="wallet.html"], .balance-pill, .wallet-link, .btn-wallet').forEach(el=>{
      el.addEventListener('click', ()=> setTimeout(tryFill, 300));
    });
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

// Background floating hearts
(function(){
  const MAX = 28;
  const spawnInterval = 700; // ms
  const containerClass = 'bg-hearts';

  let container = document.querySelector('.' + containerClass);
  if(!container){
    container = document.createElement('div');
    container.className = containerClass;
    document.body.prepend(container);
  }

  function rand(min, max){ return Math.random() * (max - min) + min }

  function createHeart(){
    if(container.children.length > MAX) return;
    const s = document.createElement('span');
    s.className = 'bg-heart';
    s.textContent = '❤';
    const size = Math.round(rand(12,28));
    const left = Math.round(rand(2,98));
    const tx = Math.round(rand(-80,80)) + 'px';
    const dur = (rand(4.5,9.5)).toFixed(2) + 's';
    s.style.fontSize = size + 'px';
    s.style.left = left + '%';
    s.style.setProperty('--tx', tx);
    s.style.animationDuration = dur;
    s.style.opacity = (rand(0.6,1)).toFixed(2);
    container.appendChild(s);
    // remove after animation
    setTimeout(()=>{ if(s && s.parentNode) s.parentNode.removeChild(s) }, (parseFloat(dur) * 1000) + 500);
  }

  // gentle initial burst
  for(let i=0;i<6;i++) setTimeout(createHeart, i*200);
  const handle = setInterval(createHeart, spawnInterval);
  // stop generating on page hide to save work
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) clearInterval(handle);
  });
})();
