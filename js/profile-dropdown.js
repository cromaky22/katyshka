(function(){
  var btn = document.getElementById('profileBtn');
  var dd = document.getElementById('profileDropdown');
  var overlay = document.getElementById('pdOverlay');
  var pdUserId = document.getElementById('pdUserId');
  var pdPromoBtn = document.getElementById('pdPromoBtn');
  if(!btn || !dd) return;

  function getId(){
    try{
      var tg = window.Telegram && window.Telegram.WebApp;
      var candidates = [
        tg && tg.initDataUnsafe && tg.initDataUnsafe.user,
        tg && tg.initDataUnsafe && tg.initDataUnsafe.receiver,
        tg && tg.user
      ];
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] && candidates[i].id) return String(candidates[i].id);
      }
    }catch(e){}
    return localStorage.getItem('tg_uid') || '\u2014';
  }

  function syncId(){
    if(pdUserId) pdUserId.textContent = getId();
  }

  function close(){ dd.classList.remove('open'); if(overlay) overlay.classList.remove('open'); }
  function open(){ syncId(); dd.classList.add('open'); if(overlay) overlay.classList.add('open'); }

  syncId();

  btn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    if(dd.classList.contains('open')) close(); else open();
  });

  if(overlay) overlay.addEventListener('click', close);

  if(pdPromoBtn){
    pdPromoBtn.addEventListener('click', function(){
      close();
      var modal = document.getElementById('promoModal');
      var input = document.getElementById('promoCodeInput');
      if(modal){ modal.style.display = ''; modal.setAttribute('aria-hidden','false'); }
      if(input) input.focus();
    });
  }

  window.ProfileDropdown = { open: open, close: close, syncId: syncId };
})();
