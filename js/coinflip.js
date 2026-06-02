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
});
