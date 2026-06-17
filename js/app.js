// Общий скрипт для навигации и splash
(function(){
  // redirect from splash
  if(document.body.classList.contains('splash')){
    setTimeout(()=>{location.href='home.html'},1200);
    return;
  }

  // === COSMIC BACKGROUND ===
  (function(){
    if(document.querySelector('.cosmic-bg')) return;
    var isBonus = document.body.classList.contains('page-bonus');
    var isWallet = document.body.classList.contains('page-wallet');
    if(isBonus || isWallet) return;
    var bg = document.createElement('div');
    bg.className = 'cosmic-bg';
    bg.innerHTML =
      '<div class="nebula n1"></div>' +
      '<div class="nebula n2"></div>' +
      '<div class="nebula n3"></div>' +
      '<div class="nebula n4"></div>' +
      '<div class="nebula n5"></div>' +
      '<div class="stars-layer">' +
        '<div class="star s1"></div><div class="star s2"></div><div class="star s3"></div>' +
        '<div class="star s4"></div><div class="star s5"></div><div class="star s6"></div>' +
        '<div class="star s7"></div><div class="star s8"></div><div class="star s9"></div>' +
        '<div class="star s10"></div><div class="star s11"></div><div class="star s12"></div>' +
        '<div class="star s13"></div><div class="star s14"></div><div class="star s15"></div>' +
        '<div class="star s16"></div><div class="star s17"></div><div class="star s18"></div>' +
        '<div class="star s19"></div><div class="star s20"></div><div class="star s21"></div>' +
        '<div class="star s22"></div><div class="star s23"></div><div class="star s24"></div>' +
        '<div class="star s25"></div><div class="star s26"></div><div class="star s27"></div>' +
        '<div class="star s28"></div><div class="star s29"></div><div class="star s30"></div>' +
      '</div>' +
      '<div class="comet c1"></div><div class="comet c2"></div><div class="comet c3"></div><div class="comet c4"></div>' +
      '<div class="shooting-star ss1"></div><div class="shooting-star ss2"></div><div class="shooting-star ss3"></div>';
    document.body.insertBefore(bg, document.body.firstChild);
  })();

  // === Referral commission helper ===
  window.reportBet = function(game, amount){
    var uid = (window.Balance && window.Balance.getUserId()) || localStorage.getItem('tg_uid') || '';
    if(!uid || !amount) return;
    fetch('/api/game/bet', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({userId: uid, game: game, amount: Math.abs(amount)})
    }).catch(function(){});
  };

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
      this._reportResult(game, 'win', amount);
    },
    addLoss: function(amount, game, detail){
      amount = Math.abs(parseFloat(amount)||0);
      var losses = parseInt(localStorage.getItem('mc_losses_count')||'0') + 1;
      localStorage.setItem('mc_losses_count', losses);
      this._addHistory('loss', amount, game, detail);
      this._reportResult(game, 'loss', amount);
    },
    _reportResult: function(game, result, amount){
      var uid = (window.Balance && window.Balance.getUserId()) || localStorage.getItem('tg_uid') || '';
      if(!uid || !amount) return;
      fetch('/api/game/result', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: uid, game: game, result: result, amount: Math.abs(amount)})
      }).catch(function(){});
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
})();

// Initialize activation system (max 10 activations)
(function(){
  const MAX_ACTIVATIONS = 10;
  let activations = parseInt(localStorage.getItem('mc_activations') || '0');
  if(activations < MAX_ACTIVATIONS){
    activations++;
    localStorage.setItem('mc_activations', activations.toString());
  }
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
    if(path === 'home.html' && !hash){
      document.querySelectorAll('.bottom-nav .nav-item').forEach(a=>a.classList.remove('active'));
      const centerBtn = document.querySelector('.bottom-nav .nav-item.center');
      if(centerBtn) centerBtn.classList.add('active');
    }
  }

  function scrollToHash(){
    const path = location.pathname.split('/').pop() || 'home.html';
    const hash = (location.hash || '').replace('#','');
    if(hash && path === 'home.html'){
      const el = document.getElementById(hash);
      if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),120);
    }
  }

  updateActive();
  scrollToHash();
  window.addEventListener('hashchange', ()=>{ updateActive(); scrollToHash(); });

  document.querySelectorAll('.bottom-nav .nav-item').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const href = a.getAttribute('href') || '';
      if(href.includes('#')){
        const current = location.pathname.split('/').pop() || 'home.html';
        const targetPath = href.split('#')[0] || 'home.html';
        const targetHash = href.split('#')[1] || '';
        if((targetPath === '' || targetPath === current) && targetHash){
          e.preventDefault();
          location.hash = targetHash;
          updateActive();
          scrollToHash();
        }
      }
    });
  });
})();

// Games search
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
        if(nameEl) nameEl.innerHTML = name;
      }
    });
    emptyEl.style.display = any ? 'none' : '';
  });
})();

// Balance module auto-initializes from balance.js on DOMContentLoaded
// Promo modal moved to js/promo-modal.js

// simple auto-scrolling carousel
(function(){
  const carousel = document.getElementById('mainCarousel');
  if(!carousel) return;
  let cards = carousel.querySelectorAll('.card');
  if(!cards.length) return;
  const originalCount = cards.length;
  const gap = parseInt(getComputedStyle(carousel).gap || 12);
  function getStep(){
    const card = carousel.querySelector('.card');
    return (card ? card.offsetWidth : 200) + gap;
  }
  const dotsContainer = document.getElementById('carouselDots');
  if(dotsContainer){
    dotsContainer.innerHTML = '';
    for(let i=0;i<originalCount;i++){
      const d = document.createElement('button');
      d.className = 'dot';
      d.dataset.index = i;
      d.type = 'button';
      d.addEventListener('click', ()=>{
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
  updateDots(0);
  let pos = 0;
  const step = getStep();
  const delay = 2200;
  let anim;
  function tick(){
    pos += step;
    if(pos > carousel.scrollWidth - carousel.clientWidth + step/2){
      carousel.scrollTo({left:0,behavior:'smooth'});
      pos = 0;
    } else {
      carousel.scrollTo({left:pos,behavior:'smooth'});
    }
    const idx = Math.round((carousel.scrollLeft || pos) / step) % originalCount;
    updateDots(idx);
  }
  anim = setInterval(tick, delay);
  ['pointerenter','pointerdown'].forEach(ev=>carousel.addEventListener(ev, ()=>clearInterval(anim)));
  ['pointerleave','pointerup'].forEach(ev=>carousel.addEventListener(ev, ()=>{anim = setInterval(tick, delay)}));
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

// Page loader overlay
(function(){
  const loader = document.createElement('div');
  loader.className = 'page-loader';
  loader.innerHTML = '<div class="loader-box"><div class="loader-ring" id="loaderRing" aria-hidden="true"></div><div class="loader-text" id="loaderText">ЗАГРУЗКА...</div></div>';
  document.body.appendChild(loader);

  function showLoader(text, mode){
    const t = document.getElementById('loaderText');
    if(t && text) t.textContent = text;
    loader.classList.remove('startup','nav');
    if(mode) loader.classList.add(mode);
    loader.classList.add('active');
  }
  function hideLoader(){ loader.classList.remove('active'); loader.classList.remove('startup','nav'); }

  try{
    const path = location.pathname.split('/').pop() || 'home.html';
    const isGames = path === 'games.html' || location.hash.replace('#','') === 'games' || !!document.getElementById('games');
    if(isGames && !sessionStorage.getItem('startupLoaderShown')){
      sessionStorage.setItem('startupLoaderShown','1');
      showLoader('ЗАГРУЗКА...', 'startup');
      setTimeout(hideLoader, 3400);
    }
  }catch(e){/*ignore*/}

  document.querySelectorAll('a').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const href = a.getAttribute('href') || '';
      if(href.startsWith('#') || href === '' ) return;
      if(a.closest && a.closest('.menu-actions')) return;
      if(a.classList && (a.classList.contains('no-loader') || a.dataset && a.dataset.noLoader)) return;
      const current = location.pathname.split('/').pop() || 'home.html';
      const targetPath = href.split('#')[0] || '';
      if(targetPath === '' || targetPath === current) return;
      e.preventDefault();
      showLoader('ЗАГРУЖАЕМ…', 'nav');
      setTimeout(()=>{ location.href = href; }, 1000);
    });
  });
})();

// Profile dropdown moved to js/profile-dropdown.js
// Telegram user info moved to js/telegram-user.js

// Wallet UI interactions
(function(){
  const modal = document.querySelector('.wallet-modal');
  if(!modal) return;

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

  showPanel('topup');

  const closeBtn = modal.querySelector('.close-modal');
  if(closeBtn) closeBtn.addEventListener('click', ()=>{ modal.style.display='none' });

  modal.querySelectorAll('.method').forEach(m=>{
    m.addEventListener('click', ()=>{
      modal.querySelectorAll('.method').forEach(x=>x.classList.remove('selected'));
      m.classList.add('selected');
    });
  });

  const amountInput = modal.querySelector('.amount-input input');
  modal.querySelectorAll('.quick-buttons .chip').forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = parseFloat(b.textContent.replace('$','').trim()) || 0;
      amountInput.value = v.toFixed(0);
    });
  });

  const pay = modal.querySelector('.pay-btn');
  if(pay) pay.addEventListener('click', ()=>{
    const val = parseFloat(amountInput.value)||0;
    if(val <= 0){ alert('Введите сумму пополнения'); return; }
    alert('Перейти к оплате: $' + val);
  });

  modal.querySelectorAll('.history-tab').forEach(ht=>{
    ht.addEventListener('click', ()=>{
      modal.querySelectorAll('.history-tab').forEach(h=>h.classList.remove('active'));
      ht.classList.add('active');
      const target = ht.dataset.h;
      modal.querySelectorAll('.history-panel').forEach(p=>{ p.style.display = (p.dataset.hpanel===target) ? '' : 'none' });
    });
  });

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
      if(withdrawBtn){
        if(val < MIN_WITHDRAW) withdrawBtn.disabled = true;
        else withdrawBtn.disabled = false;
      }
    }

    if(withdrawInput){
      withdrawInput.addEventListener('input', update);
      update();
    }
  })();
})();

// Background floating stars
(function(){
  const MAX = 15;
  const spawnInterval = 1200;
  const container = document.createElement('div');
  container.className = 'bg-stars';
  document.body.prepend(container);

  function createStar(){
    if(container.children.length > MAX) return;
    const s = document.createElement('span');
    s.className = 'bg-star';
    s.textContent = '✦';
    s.style.left = (Math.random() * 96 + 2) + '%';
    s.style.animationDuration = (Math.random() * 7 + 5) + 's';
    s.style.opacity = (Math.random() * 0.5 + 0.3).toFixed(2);
    container.appendChild(s);
    setTimeout(()=>{ s.remove(); }, 12000);
  }

  for(let i=0;i<5;i++) setTimeout(createStar, i*300);
  const handle = setInterval(createStar, spawnInterval);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) clearInterval(handle); });
})();
