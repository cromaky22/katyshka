document.addEventListener('DOMContentLoaded', function(){
  const coin = document.getElementById('coin');
  const btnHead = document.getElementById('btnHead');
  const btnTail = document.getElementById('btnTail');
  const play = document.getElementById('play');
  const resultEl = document.getElementById('result');
  let choice = null;

  btnHead.addEventListener('click', ()=>{ choice = 'head'; btnHead.classList.add('active'); btnTail.classList.remove('active'); });
  btnTail.addEventListener('click', ()=>{ choice = 'tail'; btnTail.classList.add('active'); btnHead.classList.remove('active'); });

  function randomResult(){ return Math.random() < 0.5 ? 'head' : 'tail'; }

  function showResult(res){
    resultEl.textContent = res === 'head' ? 'Выпал ОРЕЛ' : 'Выпала РЕШКА';
  }

  play.addEventListener('click', ()=>{
    if(!choice){ resultEl.textContent = 'Выберите Орел или Решка'; return }
    resultEl.textContent = '';
    coin.classList.remove('flip');
    // trigger reflow to restart animation
    void coin.offsetWidth;
    coin.classList.add('flip');
    // after animation determine result
    setTimeout(()=>{
      const r = randomResult();
      // set final face via data attribute
      if(r === 'head'){
        coin.classList.remove('show-tail');
        coin.classList.add('show-head');
      }else{
        coin.classList.remove('show-head');
        coin.classList.add('show-tail');
      }
      showResult(r);
    }, 1400);
  });

  // Multipliers navigation
  const multsContainer = document.getElementById('multipliers');
  const prevBtn = document.querySelector('.mult-prev');
  const nextBtn = document.querySelector('.mult-next');
  let multItems = [];
  let activeIndex = 0;

  function initMults(){
    if(!multsContainer) return;
    multItems = Array.from(multsContainer.querySelectorAll('.mult-item'));
    if(multItems.length === 0) return;
    multItems.forEach((it,i)=>{
      it.addEventListener('click', ()=>{ setActive(i); });
    });
    setActive(0);
    updateNavButtons();
    window.addEventListener('resize', ()=>{ centerItem(activeIndex); });
  }

  function setActive(i){
    if(!multItems.length) return;
    activeIndex = Math.max(0, Math.min(multItems.length-1, i));
    multItems.forEach((it,idx)=> it.classList.toggle('active', idx === activeIndex));
    centerItem(activeIndex);
    updateNavButtons();
  }

  function centerItem(i){
    const item = multItems[i];
    if(!item) return;
    const container = multsContainer;
    const left = item.offsetLeft + (item.offsetWidth/2) - (container.clientWidth/2);
    container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }

  function updateNavButtons(){
    if(!prevBtn || !nextBtn || !multItems.length || !multsContainer) return;
    prevBtn.disabled = multsContainer.scrollLeft <= 1;
    nextBtn.disabled = (multsContainer.scrollLeft + multsContainer.clientWidth) >= (multsContainer.scrollWidth - 1);
  }

  // page-wise scroll: move by container width
  if(prevBtn) prevBtn.addEventListener('click', ()=>{
    if(!multsContainer) return;
    const newLeft = Math.max(0, multsContainer.scrollLeft - multsContainer.clientWidth);
    multsContainer.scrollTo({ left: newLeft, behavior: 'smooth' });
    updateNavButtons();
  });
  if(nextBtn) nextBtn.addEventListener('click', ()=>{
    if(!multsContainer) return;
    const maxLeft = Math.max(0, multsContainer.scrollWidth - multsContainer.clientWidth);
    const newLeft = Math.min(maxLeft, multsContainer.scrollLeft + multsContainer.clientWidth);
    multsContainer.scrollTo({ left: newLeft, behavior: 'smooth' });
    updateNavButtons();
  });

  // update active index after user scrolls (debounced)
  let scrollTimer = null;
  if(multsContainer){
    multsContainer.addEventListener('scroll', ()=>{
      updateNavButtons();
      if(scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(()=>{
        // find item whose center is closest to container center
        const center = multsContainer.scrollLeft + (multsContainer.clientWidth/2);
        let bestIdx = 0;
        let bestDist = Infinity;
        multItems.forEach((it, idx)=>{
          const itCenter = it.offsetLeft + (it.offsetWidth/2);
          const d = Math.abs(itCenter - center);
          if(d < bestDist){ bestDist = d; bestIdx = idx; }
        });
        setActive(bestIdx);
      }, 120);
    });
  }

  // allow keyboard arrows to navigate when multipliers present
  document.addEventListener('keydown', (e)=>{
    if(!multItems.length) return;
    if(e.key === 'ArrowLeft') { e.preventDefault(); setActive(activeIndex-1); }
    if(e.key === 'ArrowRight') { e.preventDefault(); setActive(activeIndex+1); }
  });

  initMults();
});
