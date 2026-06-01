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

  // Page loader overlay: inject DOM node and handle navigation transitions
  (function(){
    // create loader element
    const loader = document.createElement('div');
    loader.className = 'page-loader';
    loader.innerHTML = '<div class="loader-box"><div class="loader-ring" id="loaderRing" aria-hidden="true"></div><div class="loader-text" id="loaderText">ЗАГРУЗКА...</div></div>';
    document.body.appendChild(loader);

    // populate ring with hearts
    (function createHearts(){
      const ring = document.getElementById('loaderRing');
      if(!ring) return;
      const count = 24;
      const radius = 56; // px
      for(let i=0;i<count;i++){
        const angle = (360 / count) * i;
        const span = document.createElement('span');
        span.className = 'heart';
        span.innerText = '❤';
        // store angle and radius in CSS variables so animations can preserve placement
        span.style.setProperty('--angle', angle + 'deg');
        span.style.setProperty('--r', '-' + radius + 'px');
        // stagger animation delay for nicer effect
        span.style.animationDelay = (i * 0.06) + 's';
        ring.appendChild(span);
      }
    })();

    function showLoader(text){
      const t = document.getElementById('loaderText');
      if(t && text) t.textContent = text;
      loader.classList.add('active');
    }
    function hideLoader(){ loader.classList.remove('active'); }

    // show loader briefly on initial page load for polish — a bit longer
    showLoader('ЗАГРУЗКА...');
    setTimeout(()=>{ hideLoader(); }, 900);

    // Intercept bottom-nav and top nav clicks to show loader before navigation
    document.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click', (e)=>{
        const href = a.getAttribute('href') || '';
        // ignore anchors that are just hashes or on-page links
        if(href.startsWith('#') || href === '' ) return;
        // allow in-page hash navigation without loader when target is same page
        const current = location.pathname.split('/').pop() || 'home.html';
        const targetPath = href.split('#')[0] || '';
        if(targetPath === '' || targetPath === current) return;
        // otherwise show loader and navigate after short delay
        e.preventDefault();
        showLoader('ЗАГРУЖАЕМ…');
        setTimeout(()=>{ location.href = href; }, 260);
      });
    });

  })();
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
      if(nameEl) nameEl.textContent = ((user.first_name||'') + (user.last_name ? (' ' + user.last_name) : '') ).trim() || (user.username || '');
      if(subEl) subEl.textContent = 'Telegram ID ' + (user.id || '');
      // set header profile image if available
      try{
        const profileImg = document.querySelector('.app-header .profile img');
        if(profileImg){
          const candidate = user.photo_url || user.avatar || (user.id ? ('/api/tg-photo/' + user.id) : null);
          if(candidate){
            profileImg.src = candidate;
            profileImg.style.display = '';
            profileImg.onerror = function(){ this.style.display = 'none'; };
          }
        }
      }catch(e){}
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
      return true;
    }

    function tryFill(){
      try{
        const tg = window.Telegram && window.Telegram.WebApp;
        if(tg){
          // try several common locations
          const u1 = tg.initDataUnsafe && tg.initDataUnsafe.user;
          if(fillFromUser(u1)) return;
          const u2 = tg.initData && tg.initData.user;
          if(fillFromUser(u2)) return;
          const u3 = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.user;
          if(fillFromUser(u3)) return;
        }
        // fallback: try global initData parse (if available)
        if(window.__tg_user){ fillFromUser(window.__tg_user); return }
        // additional fallback: try reading saved user from localStorage
        try{
          const maybe = localStorage.getItem('tg_user') || localStorage.getItem('mc_user') || localStorage.getItem('user');
          if(maybe){
            let parsed = null;
            try{ parsed = JSON.parse(maybe); }catch(e){}
            if(parsed) { fillFromUser(parsed); return }
          }
        }catch(e){}
      }catch(e){/*ignore*/}
    }

    // attempt multiple times in case WebApp initializes slightly later
    tryFill();
    let attempts = 0;
    const t = setInterval(()=>{ attempts++; tryFill(); if(attempts>6) clearInterval(t); }, 500);
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
