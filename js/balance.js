(function(){
  var _balance = 0;
  var _userId = null;
  var _socket = null;
  var _ready = false;
  var _listeners = [];
  var _socketLoading = false;
  var _socketCallbacks = [];
  var ADMIN_ID = '7239160695';

  function ensureSocketIO(cb){
    if(window.io) return cb();
    if(_socketLoading) return _socketCallbacks.push(cb);
    _socketLoading = true;
    _socketCallbacks.push(cb);
    var s = document.createElement('script');
    s.src = '/socket.io/socket.io.js';
    s.onload = function(){
      _socketCallbacks.forEach(function(fn){ fn(); });
      _socketCallbacks = [];
    };
    s.onerror = function(){
      _socketCallbacks = [];
    };
    document.head.appendChild(s);
  }

  function getUserId(){
    try{
      var tg = window.Telegram && window.Telegram.WebApp;
      if(tg && tg.initDataUnsafe && tg.initDataUnsafe.user){
        var id = String(tg.initDataUnsafe.user.id);
        localStorage.setItem('tg_uid', id);
        return id;
      }
      if(tg && tg.initDataUnsafe && tg.initDataUnsafe.receiver){
        var id2 = String(tg.initDataUnsafe.receiver.id);
        localStorage.setItem('tg_uid', id2);
        return id2;
      }
    }catch(e){}
    // Fallback to localStorage
    return localStorage.getItem('tg_uid') || null;
  }

  function fmt(n){ return Number(n).toFixed(2); }

  function updateDOM(n){
    document.querySelectorAll('.balance-value').forEach(function(el){
      el.textContent = fmt(n);
    });
  }

  function saveLocal(){
    if(_userId){
      localStorage.setItem('mc_bal_' + _userId, _balance);
    }
  }

  function loadLocal(){
    if(_userId){
      var cached = localStorage.getItem('mc_bal_' + _userId);
      if(cached !== null){
        var n = parseFloat(cached);
        if(!isNaN(n) && n >= 0) return n;
      }
    }
    return 0;
  }

  function sendToServer(data){
    if(!_userId) return;
    // Always include user info for proper record creation
    const payload = Object.assign({
      id: _userId,
      first_name: null,
      last_name: null,
      username: null,
      avatar: null
    }, data);
    
    fetch('/api/users', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    }).catch(function(err){
      console.warn('⚠️ Failed to sync balance to server:', err);
    });
  }

function loadFromServer(){
     _userId = getUserId();
     if(!_userId){
       console.warn('⚠️ No Telegram user ID');
       updateDOM(0);
       return Promise.resolve();
     }
     
     // Load from localStorage first for instant display
     _balance = loadLocal();
     updateDOM(_balance);
     
     return fetch('/api/users?id=' + encodeURIComponent(_userId))
       .then(function(r){ return r.json(); })
       .then(function(d){
         if(d && d.balance !== undefined){
           var serverBal = Math.round(parseFloat(d.balance) * 100) / 100;
           // Use server balance (not max of local/server)
           _balance = serverBal;
           saveLocal();
           updateDOM(_balance);
         }
         _ready = true;
         _listeners.forEach(function(fn){ fn(_balance); });
         _listeners = [];
       })
       .catch(function(){
         // Keep local balance on error
         _ready = true;
         _listeners.forEach(function(fn){ fn(_balance); });
         _listeners = [];
       });
   }

  function initSocket(){
    if(_socket) return;
    ensureSocketIO(function(){
      try{
        var uid = getUserId();
        _socket = io({query: {userId: uid, balance: _balance}});
        _socket.on('balance_update', function(data){
          // Update balance if it's for current user OR if current user is admin
          if(data.balance !== undefined){
            var isMyUpdate = (data.userId === getUserId());
            var isAdmin = (getUserId() === ADMIN_ID);
            if(isMyUpdate || isAdmin){
              _balance = Math.round(parseFloat(data.balance) * 100) / 100;
              saveLocal();
              updateDOM(_balance);
            }
          }
        });
        // Admin force update — update balance regardless of userId
        _socket.on('admin:balance_sync', function(data){
          if(data && data.balance !== undefined && getUserId() === ADMIN_ID){
            _balance = Math.round(parseFloat(data.balance) * 100) / 100;
            saveLocal();
            updateDOM(_balance);
          }
        });
        _socket.on('admin:obnul', function(){
          _balance = 0;
          saveLocal();
          updateDOM(0);
        });
      }catch(e){}
    });
  }

  window.Balance = {
    init: function(){
      initSocket();
      return loadFromServer();
    },
    get: function(){ return _balance; },
    set: function(v){
      var n = Math.round(Number(v) * 100) / 100;
      if(isNaN(n)) return;
      _balance = n;
      saveLocal();
      updateDOM(n);
      sendToServer({balance: n});
    },
    add: function(amount){
      var n = Math.round((_balance + Number(amount)) * 100) / 100;
      if(isNaN(n)) return;
      _balance = n;
      saveLocal();
      updateDOM(n);
      sendToServer({balance: n});
    },
    deduct: function(amount){
      var n = Math.round((_balance - Number(amount)) * 100) / 100;
      if(isNaN(n)) return;
      _balance = n;
      saveLocal();
      updateDOM(n);
      sendToServer({balance: n});
    },
    sync: function(newBal){
      _balance = Math.round(parseFloat(newBal) * 100) / 100;
      saveLocal();
      updateDOM(_balance);
    },
    saveLocal: saveLocal,
    ready: function(fn){
      if(_ready) fn(_balance);
      else _listeners.push(fn);
    },
    getUserId: function(){ return _userId || getUserId(); },
    getSocket: function(){ if(!_socket) initSocket(); return _socket; }
  };

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ Balance.init(); });
  } else {
    Balance.init();
  }
})();
