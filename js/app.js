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
