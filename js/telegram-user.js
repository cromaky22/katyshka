(function(){
  function fillFromUser(user){
    if(!user) return false;
    console.log('📷 Telegram user data:', user);

    // Fill profile name
    var nameEl = document.querySelector('.recipient-name');
    var subEl = document.querySelector('.recipient-sub');
    if(nameEl) nameEl.textContent = (user.username) || ((user.first_name||'') + (user.last_name ? (' ' + user.last_name) : '')).trim() || '';
    if(subEl) subEl.textContent = 'Telegram ID ' + (user.id || '');

    // Fill profile page name
    var profileName = document.getElementById('profileName');
    if(profileName) profileName.textContent = (user.first_name || user.username || 'Игрок') + (user.last_name ? ' ' + user.last_name : '');

    // Set header profile image
    try{
      var profileImg = document.querySelector('.app-header .profile img');
      var profileBtn = document.querySelector('.app-header .profile');
      if(profileImg && profileBtn){
        var candidate = user.photo_url || user.avatar;
        console.log('🖼️ Avatar URL:', candidate);
        if(candidate){
          profileImg.src = candidate;
          profileImg.style.display = '';
          console.log('✅ Avatar set to:', candidate);
          profileImg.onerror = function(){ console.warn('❌ Avatar failed to load'); this.style.display = 'none'; };
        } else if(user.id) {
          // Try to load avatar from Telegram API
          fetch('/api/tg-photo/' + user.id)
            .then(function(res){ if(res.ok) return res.blob(); throw new Error('No photo'); })
            .then(function(blob){
              var url = URL.createObjectURL(blob);
              profileImg.src = url;
              profileImg.style.display = '';
              console.log('✅ Avatar loaded from API');
            })
            .catch(function(){
              // Show initials as fallback
              showInitials(profileBtn, profileImg, user);
            });
        }
      }
    }catch(e){ console.error('❌ Error setting avatar:', e); }

    // Save locally for offline fallback
    try{ localStorage.setItem('tg_user', JSON.stringify(user)); }catch(e){}

    // Send to server
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
      }).then(function(res){ return res.json(); }).then(function(data){
        console.log('✅ User registered:', user.id);
      }).catch(function(){});
    }catch(e){}

    return true;
  }

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

  function tryFill(){
    try{
      var tg = window.Telegram && window.Telegram.WebApp;
      console.log('🔍 Checking Telegram WebApp:', !!tg);
      if(tg){
        console.log('✅ Telegram WebApp found');
        var u1 = tg.initDataUnsafe && tg.initDataUnsafe.user;
        console.log('📱 Try 1 - initDataUnsafe.user:', u1);
        if(fillFromUser(u1)) return;
        var u2 = tg.initData && tg.initData.user;
        console.log('📱 Try 2 - initData.user:', u2);
        if(fillFromUser(u2)) return;
        var u3 = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.user;
        console.log('📱 Try 3 - WebApp.user:', u3);
        if(fillFromUser(u3)) return;
        console.log('⚠️ No user data found in Telegram WebApp');
      } else {
        console.log('⚠️ Telegram WebApp not available');
      }
      if(window.__tg_user){ console.log('💾 Found __tg_user:', window.__tg_user); fillFromUser(window.__tg_user); return; }
      try{
        var maybe = localStorage.getItem('tg_user') || localStorage.getItem('mc_user') || localStorage.getItem('user');
        if(maybe){
          console.log('💾 Found saved user in localStorage');
          var parsed = null;
          try{ parsed = JSON.parse(maybe); }catch(e){}
          if(parsed){ fillFromUser(parsed); return; }
        }
      }catch(e){ console.error('❌ localStorage error:', e); }
    }catch(e){ console.error('❌ tryFill error:', e); }
  }

  // Initialize Telegram WebApp
  try{
    var tg = window.Telegram && window.Telegram.WebApp;
    if(tg){
      tg.ready();
      tg.expand();
      console.log('✅ Telegram WebApp initialized');
    }
  }catch(e){ console.error('❌ WebApp init error:', e); }

  // Attempt multiple times with increasing delays
  console.log('🚀 Starting Telegram user detection...');
  tryFill();
  var attempts = 0;
  var t = setInterval(function(){
    attempts++;
    if(attempts<=10){ console.log('🔄 Retry ' + attempts + '...'); tryFill(); }
    if(attempts>=10) clearInterval(t);
  }, 300);
})();
