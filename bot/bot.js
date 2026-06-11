const { Telegraf } = require('telegraf');

const token = '8990571924:AAEmFncvswq59dZAJ727_eS5yo2bVoj5LYA';
const bot = new Telegraf(token);

const WEB_URL = process.env.WEB_URL || 'https://cromaky22.github.io/katyshka/';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Store authorized admin sessions in memory
const adminSessions = new Set();

// === START ===
bot.start((ctx) => {
  ctx.reply('🎰 Добро пожаловать в KATYSHKA!\n\nНажмите кнопку чтобы открыть приложение:', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎮 Открыть KATYSHKA', web_app: { url: WEB_URL } }
      ]]
    }
  });
});

// === ADMIN LOGIN ===
bot.command('admin', (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    ctx.reply('🔐 Введите пароль: /admin <пароль>');
    return;
  }
  const password = args[1];
  if (password === ADMIN_PASSWORD) {
    adminSessions.add(ctx.from.id);
    ctx.reply('✅ Админ-панель активирована!', adminMenuKeyboard());
  } else {
    ctx.reply('❌ Неверный пароль.');
  }
});

// === OBNUL ===
bot.command('obnul', async (ctx) => {
  if (!adminSessions.has(ctx.from.id)) {
    ctx.reply('🔐 Сначала авторизуйтесь: /admin <пароль>');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/admin/obnul`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'obnul2026' })
    });
    const data = await res.json();
    if (data.ok) {
      ctx.reply('✅ Все балансы, ставки и промокоды обнулены.');
    } else {
      ctx.reply(`❌ Ошибка: ${data.error || 'неизвестная'}`);
    }
  } catch (e) {
    ctx.reply('❌ Ошибка соединения с сервером.');
  }
});

// === GIVE BALANCE ===
bot.command('give', async (ctx) => {
  if (!adminSessions.has(ctx.from.id)) {
    ctx.reply('🔐 Сначала авторизуйтесь: /admin <пароль>');
    return;
  }
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    ctx.reply('💰 Использование: /give <userId> <amount>\nПример: /give 7239160695 10');
    return;
  }
  const targetId = args[1];
  const amount = parseFloat(args[2]);
  if (isNaN(amount) || amount <= 0) {
    ctx.reply('❌ Неверная сумма');
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: targetId, balance: amount })
    });
    const data = await res.json();
    if (data.ok) {
      ctx.reply(`✅ Выдано $${amount.toFixed(2)} пользователю ${targetId}\nТекущий баланс: $${data.balance.toFixed(2)}`);
    } else {
      ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`);
    }
  } catch (e) {
    ctx.reply('❌ Ошибка соединения с сервером.');
  }
});

// === ADMIN MENU KEYBOARD ===
function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '👥 Список пользователей', callback_data: 'admin:users' }],
      [{ text: '💰 Обнулить всё', callback_data: 'admin:obnul' }],
      [{ text: '📊 Статистика', callback_data: 'admin:stats' }],
      [{ text: '🚪 Выйти', callback_data: 'admin:logout' }]
    ]
  };
}

// === CALLBACK HANDLER ===
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  if (!data.startsWith('admin:')) return;
  if (!adminSessions.has(userId) && data !== 'admin:logout') {
    ctx.answerCbQuery('🔐 Сначала авторизуйтесь: /admin <пароль>');
    return;
  }

  if (data === 'admin:users') {
    try {
      const res = await fetch(`${SERVER_URL}/api/users`);
      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) {
        await ctx.editMessageText('Пользователей пока нет.', { reply_markup: adminMenuKeyboard() });
      } else {
        const lines = users.map(u => {
          const name = ((u.first_name || '') + (u.last_name ? ' ' + u.last_name : '')).trim() || u.username || u.id;
          const bal = (u.balance != null) ? Number(u.balance).toFixed(2) : '0.00';
          return `• ${name} — $${bal}`;
        }).join('\n');
        await ctx.editMessageText(`👥 Пользователи (${users.length}):\n\n${lines}`, { reply_markup: adminMenuKeyboard() });
      }
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка загрузки пользователей.', { reply_markup: adminMenuKeyboard() });
    }
    ctx.answerCbQuery();
  }

  if (data === 'admin:obnul') {
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/obnul`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'obnul2026' })
      });
      const result = await res.json();
      if (result.ok) {
        await ctx.editMessageText('✅ Все балансы, ставки и промокоды обнулены!', { reply_markup: adminMenuKeyboard() });
      } else {
        await ctx.editMessageText(`❌ Ошибка: ${result.error}`, { reply_markup: adminMenuKeyboard() });
      }
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка соединения с сервером.', { reply_markup: adminMenuKeyboard() });
    }
    ctx.answerCbQuery();
  }

  if (data === 'admin:stats') {
    try {
      const res = await fetch(`${SERVER_URL}/api/users`);
      const users = await res.json();
      const totalUsers = Array.isArray(users) ? users.length : 0;
      const totalBalance = Array.isArray(users) ? users.reduce((s, u) => s + (u.balance || 0), 0).toFixed(2) : '0.00';
      await ctx.editMessageText(`📊 Статистика:\n\n👥 Пользователей: ${totalUsers}\n💰 Общий баланс: $${totalBalance}`, { reply_markup: adminMenuKeyboard() });
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка загрузки статистики.', { reply_markup: adminMenuKeyboard() });
    }
    ctx.answerCbQuery();
  }

  if (data === 'admin:logout') {
    adminSessions.delete(userId);
    await ctx.editMessageText('🚪 Вы вышли из админ-панели.');
    ctx.answerCbQuery();
  }
});

// === WEB APP DATA ===
bot.on('web_app_data', async (ctx) => {
  try {
    const data = ctx.webAppData.data;
    console.log('Received web app data:', data);
    await ctx.answerWebAppQuery(ctx.webAppData.button_text, {
      type: 'article',
      id: '1',
      title: 'Успешно',
      input_message_content: { message_text: 'Спасибо!' }
    });
  } catch (e) {
    console.error('Error handling web app data:', e);
  }
});

bot.launch().then(() => console.log('Bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
