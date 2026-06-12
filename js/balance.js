(function(){
  var _balance = 0;
  var _userId = null;
  var _socket = null;
  var _ready = false;
  var _listeners = [];
  var _socketLoading = false;
  var _socketCallbacks = [];

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
        return String(tg.initDataUnsafe.user.id);
      }
    }catch(e){}
    var saved = localStorage.getItem('tg_uid');
    if(saved) return saved;
    var rid = 'u' + Math.random().toString(36).substr(2,9);
    localStorage.setItem('tg_uid', rid);
    return rid;
  }

  function fmt(n){ return Number(n).toFixed(2); }

  function updateDOM(n){
    document.querySelectorAll('.balance-value').forEach(function(el){
      el.textContent = fmt(n);
    });
  }

  function loadFromServer(){
    _userId = getUserId();
    var cached = localStorage.getItem('mc_balance');
    if(cached !== null && cached !== 'NaN'){
      var cv = parseFloat(cached);
      if(!isNaN(cv) && cv >= 0){
        _balance = Math.round(cv * 100) / 100;
        updateDOM(_balance);
      }
    }
    return fetch('/api/users?id=' + encodeURIComponent(_userId))
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d && d.balance !== undefined){
          var serverBal = Math.round(parseFloat(d.balance) * 100) / 100;
          if(serverBal > _balance) _balance = serverBal;
        }
        localStorage.setItem('mc_balance', fmt(_balance));
        updateDOM(_balance);
        _ready = true;
        _listeners.forEach(function(fn){ fn(_balance); });
        _listeners = [];
      })
      .catch(function(){
        var stored = localStorage.getItem('mc_balance');
        _balance = stored ? (Math.round(parseFloat(stored) * 100) / 100) : 0;
        if(isNaN(_balance) || _balance < 0) _balance = 0;
        updateDOM(_balance);
        _ready = true;
        _listeners.forEach(function(fn){ fn(_balance); });
        _listeners = [];
      });
  }

  function syncToServer(newBal){
    if(!_userId) return;
    fetch('/api/users', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: _userId, balance: newBal})
    }).catch(function(){});
  }

  function initSocket(){
    if(_socket) return;
    ensureSocketIO(function(){
      try{
        _socket = io({query: {userId: getUserId(), balance: _balance}});
        _socket.on('balance_update', function(data){
          if(data.userId === getUserId() && data.balance !== undefined){
            var serverBal = Math.round(parseFloat(data.balance) * 100) / 100;
            if(serverBal > _balance) _balance = serverBal;
            localStorage.setItem('mc_balance', fmt(_balance));
            updateDOM(_balance);
          }
        });
        _socket.on('admin:obnul', function(){
          _balance = 0;
          localStorage.setItem('mc_balance', '0.00');
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
    initOffline: function(){
      return loadFromServer();
    },
    get: function(){ return _balance; },
    set: function(v){
      var n = Math.round(Number(v) * 100) / 100;
      if(isNaN(n)) return;
      _balance = n;
      localStorage.setItem('mc_balance', fmt(n));
      updateDOM(n);
    },
    add: function(amount){
      var n = Math.round((_balance + Number(amount)) * 100) / 100;
      if(isNaN(n)) return;
      _balance = n;
      localStorage.setItem('mc_balance', fmt(n));
      updateDOM(n);
    },
    deduct: function(amount){
      var n = Math.round((_balance - Number(amount)) * 100) / 100;
      if(isNaN(n)) return;
      _balance = n;
      localStorage.setItem('mc_balance', fmt(n));
      updateDOM(n);
    },
    sync: function(newBal){
      var serverBal = Math.round(parseFloat(newBal) * 100) / 100;
      if(serverBal > _balance) _balance = serverBal;
      localStorage.setItem('mc_balance', fmt(_balance));
      updateDOM(_balance);
    },
    syncToServer: syncToServer,
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
