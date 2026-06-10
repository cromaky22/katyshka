document.addEventListener('DOMContentLoaded', function(){
  function getUser(){
    try{
      const tg = window.Telegram && window.Telegram.WebApp;
      if(tg && tg.initDataUnsafe && tg.initDataUnsafe.user){
        return tg.initDataUnsafe.user;
      }
    }catch(e){}
    try{
      const saved = localStorage.getItem('tg_user');
      if(saved) return JSON.parse(saved);
    }catch(e){}
    return null;
  }

  function getUserId(){
    const u = getUser();
    if(u && u.id) return String(u.id);
    let sid = sessionStorage.getItem('mc_user_id');
    if(!sid){ sid = 'mc_' + Math.random().toString(36).substr(2,8); sessionStorage.setItem('mc_user_id', sid); }
    return sid;
  }

  function getUserName(){
    const u = getUser();
    if(u) return (u.first_name || '') + (u.last_name ? ' ' + u.last_name : '') || u.username || 'Игрок';
    return 'Игрок';
  }

  function getUserAvatar(){
    const u = getUser();
    if(u) return u.photo_url || u.avatar || '';
    return '';
  }

  function getUserInitials(){
    const name = getUserName();
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?';
  }

  // Fill profile data
  const userId = getUserId();
  const userName = getUserName();
  const userAvatar = getUserAvatar();

  const nameEl = document.getElementById('profileName');
  const idDisplay = document.getElementById('profileIdDisplay');
  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarWrap = document.getElementById('profileAvatarBig');
  const balanceEl = document.getElementById('profileBalance');

  if(nameEl) nameEl.textContent = userName;
  if(idDisplay) idDisplay.textContent = userId;
  if(balanceEl){
    const bal = parseFloat(localStorage.getItem('mc_balance') || '100');
    balanceEl.textContent = '$' + bal.toFixed(2);
  }

  if(avatarImg && userAvatar){
    avatarImg.src = userAvatar;
    avatarImg.style.display = '';
    avatarImg.onerror = function(){ this.style.display = 'none'; };
  }
  if(avatarWrap){
    let initialsEl = avatarWrap.querySelector('.avatar-initials');
    if(!initialsEl){
      initialsEl = document.createElement('div');
      initialsEl.className = 'avatar-initials';
      avatarWrap.appendChild(initialsEl);
    }
    initialsEl.textContent = getUserInitials();
    initialsEl.style.display = userAvatar ? 'none' : 'flex';
  }

  // Stats
  const gamesEl = document.getElementById('profileGames');
  const winsEl = document.getElementById('profileWins');
  const promosEl = document.getElementById('profilePromos');

  if(gamesEl){
    const games = parseInt(localStorage.getItem('mc_games_played') || '0');
    gamesEl.textContent = games;
  }
  if(winsEl){
    const wins = parseFloat(localStorage.getItem('mc_total_wins') || '0');
    winsEl.textContent = '$' + wins.toFixed(2);
  }
  if(promosEl){
    try{
      const activated = JSON.parse(localStorage.getItem('mc_activated_promos') || '[]');
      promosEl.textContent = activated.length;
    }catch(e){ promosEl.textContent = '0'; }
  }

  // Promo modal from profile page
  const promoBtn = document.getElementById('pdPromoBtn');
  const promoModal = document.getElementById('promoModal');
  if(promoBtn && promoModal){
    promoBtn.addEventListener('click', function(){
      promoModal.style.display = '';
      promoModal.setAttribute('aria-hidden','false');
      const input = document.getElementById('promoCodeInput');
      if(input) input.focus();
    });
  }
});
