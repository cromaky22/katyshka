(function(){
  var avatarSet = false;
  var nameSet = false;

  function showInitials(profileBtn, profileImg, user){
    var name = user.username || (user.first_name || '') + (user.last_name ? ' ' + user.last_name : '');
    var initials = name.trim() ? name.trim().split(' ').map(function(n){ return n[0]; }).join('').toUpperCase().slice(0, 2) : '?';
    profileImg.style.display = 'none';
    var initialsEl = profileBtn.querySelector('.avatar-initials');
    if(!initialsEl){
      initialsEl = document.createElement('div');
      initialsEl.className = 'avatar-initials';
      profileBtn.appendChild(initialsEl);
    }
    initialsEl.textContent = initials;
    initialsEl.style.display = 'flex';
  }

  function fillFromUser(user){
    if(!user) return false;

    var nameEl = document.querySelector('.recipient-name');
    var subEl = document.querySelector('.recipient-sub');
    var displayName = (user.username) || ((user.first_name||'') + (user.last_name ? (' ' + user.last_name) : '')).trim() || '';

    if(nameEl && !nameSet){ nameEl.textContent = displayName; nameSet = true; }
    if(subEl) subEl.textContent = 'Telegram ID ' + (user.id || '');

    var profileName = document.getElementById('profileName');
    if(profileName && !nameSet){
      var fullName = (user.first_name || user.username || 'Игрок') + (user.last_name ? ' ' + user.last_name : '');
      profileName.textContent = fullName;
      nameSet = true;
    }

    if(!avatarSet){
      try{
        var profileImg = document.querySelector('.app-header .profile img');
        var profileBtn = document.querySelector('.app-header .profile');
        if(profileImg && profileBtn){
          var candidate = user.photo_url || user.avatar;
          if(candidate){
            profileImg.src = candidate;
            profileImg.style.display = '';
            profileImg.onerror = function(){ this.style.display = 'none'; };
            avatarSet = true;
          } else if(user.id) {
            fetch('/api/tg-photo/' + user.id)
              .then(function(res){ if(res.ok) return res.blob(); throw new Error('No photo'); })
              .then(function(blob){
                profileImg.src = URL.createObjectURL(blob);
                profileImg.style.display = '';
                avatarSet = true;
              })
              .catch(function(){ showInitials(profileBtn, profileImg, user); avatarSet = true; });
          }
        }
      }catch(e){}
    }

    try{ localStorage.setItem('tg_user', JSON.stringify(user)); }catch(e){}

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
      }).catch(function(){});
    }catch(e){}

    return true;
  }

  function tryFill(){
    try{
      var tg = window.Telegram && window.Telegram.WebApp;
      if(tg){
        var u1 = tg.initDataUnsafe && tg.initDataUnsafe.user;
        if(fillFromUser(u1)) return;
        var u2 = tg.initData && tg.initData.user;
        if(fillFromUser(u2)) return;
        var u3 = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.user;
        if(fillFromUser(u3)) return;
      }
      if(window.__tg_user){ fillFromUser(window.__tg_user); return; }
      try{
        var maybe = localStorage.getItem('tg_user') || localStorage.getItem('mc_user') || localStorage.getItem('user');
        if(maybe){
          var parsed = null;
          try{ parsed = JSON.parse(maybe); }catch(e){}
          if(parsed){ fillFromUser(parsed); return; }
        }
      }catch(e){}
    }catch(e){}
  }

  try{
    var tg = window.Telegram && window.Telegram.WebApp;
    if(tg){ tg.ready(); tg.expand(); }
  }catch(e){}

  tryFill();
  var attempts = 0;
  var t = setInterval(function(){
    attempts++;
    if(!avatarSet && attempts <= 10){ tryFill(); }
    if(attempts >= 10 || avatarSet) clearInterval(t);
  }, 300);
})();
