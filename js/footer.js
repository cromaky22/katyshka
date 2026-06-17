// === FOOTER ===
(function(){
  function initFooter(){
    if(document.getElementById('app-footer')) return;
    var footer = document.createElement('div');
    footer.id = 'app-footer';
    footer.style.cssText = 'text-align:center;padding:20px 16px 120px;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.8;';
    footer.innerHTML =
      '<div style="margin-bottom:6px;color:rgba(255,255,255,0.7);font-size:12px">18+ · Все права защищены</div>' +
      '<div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:6px">' +
        '<a href="#" id="footer-privacy" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:12px;transition:color 0.2s">Политика конфиденциальности</a>' +
        '<span style="color:rgba(255,255,255,0.3)">·</span>' +
        '<span style="color:rgba(255,255,255,0.5);font-size:12px">AML Policy</span>' +
        '</div>';
    document.body.appendChild(footer);
    document.getElementById('footer-privacy').addEventListener('click', function(e){
      e.preventDefault();
      showPrivacy();
    });
  }

  function showPrivacy(){
    if(document.getElementById('privacy-modal-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'privacy-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px)';
    overlay.innerHTML =
      '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;max-width:460px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">' +
          '<span style="font-size:16px;font-weight:800;color:#fff">🔒 Политика конфиденциальности</span>' +
          '<button id="privacy-close" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:22px;cursor:pointer;padding:0 4px;line-height:1">✕</button>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;font-size:12px;line-height:1.7;color:rgba(255,255,255,0.6)">' +
          '<p style="margin-bottom:12px"><strong style="color:#fff">1. Общие положения</strong><br>Настоящая политика конфиденциальности описывает, как мы собираем, используем и защищаем персональные данные пользователей. Используя приложение, вы соглашаетесь с условиями данной политики.</p>' +
          '<p style="margin-bottom:12px"><strong style="color:#fff">2. Сбор данных</strong><br>Мы собираем только те данные, которые необходимы для работы сервиса: идентификатор пользователя Telegram, имя, аватар, а также данные о транзакциях и игровой активности.</p>' +
          '<p style="margin-bottom:12px"><strong style="color:#fff">3. Использование данных</strong><br>Собранные данные используются для обработки платежей, предотвращения мошенничества, улучшения сервиса и соблюдения требований AML/KYC.</p>' +
          '<p style="margin-bottom:12px"><strong style="color:#fff">4. Защита данных</strong><br>Мы применяем современные методы шифрования и защиты данных. Доступ к персональным данным имеют только уполномоченные сотрудники.</p>' +
          '<p style="margin-bottom:12px"><strong style="color:#fff">5. Передача данных третьим лицам</strong><br>Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением случаев, предусмотренных законодательством.</p>' +
          '<p><strong style="color:#fff">6. Контакты</strong><br>По вопросам конфиденциальности обращайтесь в поддержку через Telegram.</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) closePrivacy(); });
    document.getElementById('privacy-close').addEventListener('click', closePrivacy);
  }

  function closePrivacy(){
    var el = document.getElementById('privacy-modal-overlay');
    if(el) el.remove();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initFooter);
  } else {
    initFooter();
  }
})();