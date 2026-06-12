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
      if(tg && tg.initDataUnsafe && tg.initDataUnsafe.receiver){
        return String(tg.initDataUnsafe.receiver.id);
      }
    }catch(e){}
    return null;
  }

  function fmt(n){ return Number(n).toFixed(2); }

  function updateDOM(n){
    document.querySelectorAll('.balance-value').forEach(function(el){
      el.textContent = fmt(n);
    });
  }

  function sendToServer(data){
    if(!_userId) return;
    fetch('/api/users', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(Object.assign({id: _userId}, data))
    }).catch(function(){});
  }

  function loadFromServer(){
    _userId = getUserId();
    if(!_userId){
      console.warn('⚠️ No Telegram user ID — open in Telegram');
      updateDOM(0);
      return Promise.resolve();
    }
    return fetch('/api/users?id=' + encodeURIComponent(_userId))
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d && d.balance !== undefined){
          _balance = Math.round(parseFloat(d.balance) * 100) / 100;
        }
        updateDOM(_balance);
        _ready = true;
        _listeners.forEach(function(fn){ fn(_balance); });
        _listeners = [];
      })
      .catch(function(){
        updateDOM(_balance);
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
          if(data.userId === getUserId() && data.balance !== undefined){
            _balance = Math.round(parseFloat(data.balance) * 100) / 100;
            updateDOM(_balance);
          }
        });
        _socket.on('admin:obnul', function(){
          _balance = 0;
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
      updateDOM(n);
      sendToServer({balance: n});
    },
    add: function(amount){
      var n = Math.round((_balance + Number(amount)) * 100) / 100;
      if(isNaN(n)) return;
      _balance = n;
      updateDOM(n);
      sendToServer({balance: n});
    },
    deduct: function(amount){
      var n = Math.round((_balance - Number(amount)) * 100) / 100;
      if(isNaN(n)) return;
      _balance = n;
      updateDOM(n);
      sendToServer({balance: n});
    },
    sync: function(newBal){
      _balance = Math.round(parseFloat(newBal) * 100) / 100;
      updateDOM(_balance);
    },
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
