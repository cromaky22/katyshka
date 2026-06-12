const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');

const token = '8990571924:AAEmFncvswq59dZAJ727_eS5yo2bVoj5LYA';
const bot = new Telegraf(token);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'obnul2026';

// Admin sessions
const adminSessions = new Map();

function getSession(userId) {
  if (!adminSessions.has(userId)) {
    adminSessions.set(userId, { authenticated: false, state: 'idle' });
  }
  return adminSessions.get(userId);
}

function setSession(userId, data) {
  adminSessions.set(userId, { ...getSession(userId), ...data });
}

function mainMenu() {
  return {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Статистика', callback_data: 'admin:stats' }, { text: '👥 Пользователи', callback_data: 'admin:users' }],
        [{ text: '💰 Выдать баланс', callback_data: 'admin:give' }, { text: '💸 Списать баланс', callback_data: 'admin:take' }],
        [{ text: '⚡ Установить баланс', callback_data: 'admin:set' }, { text: '🔍 Найти юзера', callback_data: 'admin:find' }],
        [{ text: '💰➕ Пополнить себе', callback_data: 'admin:addme' }],
        [{ text: '🗑 Обнулить ВСЁ', callback_data: 'admin:obnul' }],
        [{ text: '🔓 Выйти', callback_data: 'admin:logout' }]
      ]
    }
  };
}

function backMenu() {
  return {
    reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] }
  };
}

// START
bot.start((ctx) => {
  setSession(ctx.from.id, { authenticated: true, state: 'idle' });
  ctx.reply('🎛 **Админ-панель KATYSHKA**\n\nВыберите действие:', mainMenu());
});

// TEXT HANDLER
bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  const session = getSession(userId);
  
  console.log(`[BOT] User ${userId}: text="${text}", state="${session.state}", auth=${session.authenticated}`);
  
  // Check password if not authenticated
  if (!session.authenticated) {
    if (text === ADMIN_SECRET) {
      setSession(userId, { authenticated: true, state: 'idle' });
      ctx.reply('✅ Доступ разрешён!');
      return ctx.reply('🎛 **Админ-панель KATYSHKA**\n\nВыберите действие:', mainMenu());
    }
    return ctx.reply('🔐 Неверный пароль.');
  }
  
  // State: waiting for user ID to give balance
  if (session.state === 'give_id') {
    session.targetId = text;
    setSession(userId, { state: 'give_amount' });
    return ctx.reply(`💰 Введите сумму для выдачи пользователю ${text}:`);
  }
  
  // State: waiting for amount to give
  if (session.state === 'give_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Неверная сумма.');
    try {
      const res = await fetch(`${SERVER_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.targetId, balance: amount })
      });
      const data = await res.json();
      setSession(userId, { state: 'idle', targetId: null });
      if (data.ok) {
        return ctx.reply(`✅ Выдано $${amount.toFixed(2)} пользователю ${session.targetId}\nТекущий баланс: $${data.balance.toFixed(2)}`, backMenu());
      }
      return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`, backMenu());
    } catch (e) {
      setSession(userId, { state: 'idle' });
      return ctx.reply('❌ Ошибка соединения с сервером.', backMenu());
    }
  }
  
  // State: waiting for user ID to take balance
  if (session.state === 'take_id') {
    session.targetId = text;
    setSession(userId, { state: 'take_amount' });
    return ctx.reply(`💸 Введите сумму для списания у пользователя ${text}:`);
  }
  
  // State: waiting for amount to take
  if (session.state === 'take_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Неверная сумма.');
    try {
      const getRes = await fetch(`${SERVER_URL}/api/users?id=${session.targetId}`);
      const userData = await getRes.json();
      const currentBalance = userData.balance || 0;
      const newBalance = Math.max(0, currentBalance - amount);
      const res = await fetch(`${SERVER_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.targetId, balance: newBalance })
      });
      const data = await res.json();
      setSession(userId, { state: 'idle', targetId: null });
      if (data.ok) {
        return ctx.reply(`💸 Списано $${amount.toFixed(2)} у ${session.targetId}\nБыло: $${currentBalance.toFixed(2)}\nТекущий: $${data.balance.toFixed(2)}`, backMenu());
      }
      return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`, backMenu());
    } catch (e) {
      setSession(userId, { state: 'idle' });
      return ctx.reply('❌ Ошибка соединения с сервером.', backMenu());
    }
  }
  
  // State: waiting for user ID to set balance
  if (session.state === 'set_id') {
    session.targetId = text;
    setSession(userId, { state: 'set_amount' });
    return ctx.reply(`⚡ Введите новый баланс для пользователя ${text}:`);
  }
  
  // State: waiting for balance amount to set
  if (session.state === 'set_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount < 0) return ctx.reply('❌ Неверная сумма.');
    try {
      const res = await fetch(`${SERVER_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.targetId, balance: amount })
      });
      const data = await res.json();
      setSession(userId, { state: 'idle', targetId: null });
      if (data.ok) {
        return ctx.reply(`⚡ Баланс ${session.targetId} установлен: $${amount.toFixed(2)}`, backMenu());
      }
      return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`, backMenu());
    } catch (e) {
      setSession(userId, { state: 'idle' });
      return ctx.reply('❌ Ошибка соединения с сервером.', backMenu());
    }
  }
  
  // State: waiting for user ID to find
  if (session.state === 'find_id') {
    const targetId = text;
    try {
      const res = await fetch(`${SERVER_URL}/api/users?id=${targetId}`);
      const data = await res.json();
      setSession(userId, { state: 'idle' });
      if (data && data.balance !== undefined) {
        const name = data.first_name || data.username || targetId;
        const bal = (data.balance || 0).toFixed(2);
        return ctx.reply(`👤 **Пользователь**\n\n🆔 ID: \`${targetId}\`\n📛 Имя: ${name}\n💰 Баланс: $${bal}`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Выдать', callback_data: `admin:quick_give:${targetId}` }, { text: '💸 Списать', callback_data: `admin:quick_take:${targetId}` }],
              [{ text: '🔙 Назад', callback_data: 'admin:back' }]
            ]
          }
        });
      }
      return ctx.reply(`❌ Пользователь ${targetId} не найден.`, backMenu());
    } catch (e) {
      setSession(userId, { state: 'idle' });
      return ctx.reply('❌ Ошибка соединения.', backMenu());
    }
  }
  
  // State: waiting for amount to add to self
  if (session.state === 'addme_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Неверная сумма.');
    try {
      const myId = String(userId);
      const getRes = await fetch(`${SERVER_URL}/api/users?id=${myId}`);
      const userData = await getRes.json();
      const currentBalance = userData.balance || 0;
      const newBalance = currentBalance + amount;
      const res = await fetch(`${SERVER_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: myId, balance: newBalance })
      });
      const data = await res.json();
      setSession(userId, { state: 'idle' });
      if (data.ok) {
        return ctx.reply(`💰✅ Баланс пополнен!\n\nБыло: $${currentBalance.toFixed(2)}\nДобавлено: $${amount.toFixed(2)}\nИтого: $${data.balance.toFixed(2)}`, backMenu());
      }
      return ctx.reply(`❌ Ошибка: ${data.error}`, backMenu());
    } catch (e) {
      setSession(userId, { state: 'idle' });
      return ctx.reply('❌ Ошибка соединения.', backMenu());
    }
  }
  
  // Unknown command
  ctx.reply('❓ Неизвестная команда. Используйте кнопки меню.', backMenu());
});

// CALLBACK HANDLER
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  
  console.log(`[BOT] User ${userId}: callback="${data}"`);
  
  if (!data.startsWith('admin:')) return;
  
  const session = getSession(userId);
  
  // Allow logout without auth
  if (data === 'admin:logout') {
    setSession(userId, { authenticated: false, state: 'idle' });
    await ctx.editMessageText('🚪 Вы вышли. Введите пароль для повторного входа.');
    return ctx.answerCbQuery();
  }
  
  // Check auth for other commands
  if (!session.authenticated) {
    return ctx.answerCbQuery('🔐 Введите пароль.');
  }
  
  // Quick give
  if (data.startsWith('admin:quick_give:')) {
    const targetId = data.split(':')[2];
    setSession(userId, { state: 'give_amount', targetId });
    await ctx.answerCbQuery();
    return ctx.reply(`💰 Введите сумму для выдачи пользователю ${targetId}:`);
  }
  
  // Quick take
  if (data.startsWith('admin:quick_take:')) {
    const targetId = data.split(':')[2];
    setSession(userId, { state: 'take_amount', targetId });
    await ctx.answerCbQuery();
    return ctx.reply(`💸 Введите сумму для списания у пользователя ${targetId}:`);
  }
  
  // Quick set
  if (data.startsWith('admin:quick_set:')) {
    const targetId = data.split(':')[2];
    setSession(userId, { state: 'set_amount', targetId });
    await ctx.answerCbQuery();
    return ctx.reply(`⚡ Введите новый баланс для ${targetId}:`);
  }
  
  // Stats
  if (data === 'admin:stats') {
    try {
      const res = await fetch(`${SERVER_URL}/api/users`);
      const users = await res.json();
      const totalUsers = Array.isArray(users) ? users.length : 0;
      const totalBalance = Array.isArray(users) ? users.reduce((s, u) => s + (u.balance || 0), 0).toFixed(2) : '0.00';
      await ctx.editMessageText(`📊 **Статистика**\n\n👥 Пользователей: ${totalUsers}\n💰 Общий баланс: $${totalBalance}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] }
      });
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка загрузки.');
    }
    return ctx.answerCbQuery();
  }
  
  // Users list
  if (data === 'admin:users') {
    try {
      const res = await fetch(`${SERVER_URL}/api/users`);
      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) {
        await ctx.editMessageText('Пользователей пока нет.', { reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] } });
      } else {
        let msg = `👥 **Пользователи (${users.length}):**\n\n`;
        const buttons = [];
        users.forEach(u => {
          const name = ((u.first_name || '') + (u.last_name ? ' ' + u.last_name : '')).trim() || u.username || u.id;
          const bal = (u.balance != null) ? Number(u.balance).toFixed(2) : '0.00';
          msg += `• \`${u.id}\` — ${name} — $${bal}\n`;
          buttons.push([{ text: `👤 ${name} ($${bal})`, callback_data: `admin:user:${u.id}` }]);
        });
        buttons.push([{ text: '🔙 Назад', callback_data: 'admin:back' }]);
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
      }
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка.', { reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] } });
    }
    return ctx.answerCbQuery();
  }
  
  // User details
  if (data.startsWith('admin:user:')) {
    const targetId = data.split(':')[2];
    try {
      const res = await fetch(`${SERVER_URL}/api/users?id=${targetId}`);
      const u = await res.json();
      const name = u?.first_name || u?.username || targetId;
      const bal = (u?.balance || 0).toFixed(2);
      await ctx.editMessageText(`👤 **${name}**\n🆔 \`${targetId}\`\n💰 Баланс: $${bal}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Выдать', callback_data: `admin:quick_give:${targetId}` }, { text: '💸 Списать', callback_data: `admin:quick_take:${targetId}` }],
            [{ text: '⚡ Установить', callback_data: `admin:quick_set:${targetId}` }],
            [{ text: '🔙 Назад', callback_data: 'admin:users' }]
          ]
        }
      });
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка.');
    }
    return ctx.answerCbQuery();
  }
  
  // Give balance - ask for user ID
  if (data === 'admin:give') {
    setSession(userId, { state: 'give_id' });
    await ctx.answerCbQuery();
    return ctx.reply('💰 Введите ID пользователя:');
  }
  
  // Take balance - ask for user ID
  if (data === 'admin:take') {
    setSession(userId, { state: 'take_id' });
    await ctx.answerCbQuery();
    return ctx.reply('💸 Введите ID пользователя:');
  }
  
  // Set balance - ask for user ID
  if (data === 'admin:set') {
    setSession(userId, { state: 'set_id' });
    await ctx.answerCbQuery();
    return ctx.reply('⚡ Введите ID пользователя:');
  }
  
  // Find user
  if (data === 'admin:find') {
    setSession(userId, { state: 'find_id' });
    await ctx.answerCbQuery();
    return ctx.reply('🔍 Введите ID пользователя для поиска:');
  }
  
  // Add to self
  if (data === 'admin:addme') {
    setSession(userId, { state: 'addme_amount' });
    await ctx.answerCbQuery();
    return ctx.reply(`💰➕ Введите сумму для пополнения вашего баланса (ID: ${userId}):`);
  }
  
  // Obnul confirmation
  if (data === 'admin:obnul') {
    await ctx.editMessageText('🗑 **Вы уверены?** Это обнулит ВСЕ балансы, ставки и промокоды!', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Да, обнулить всё', callback_data: 'admin:obnul_confirm' }],
          [{ text: '❌ Отмена', callback_data: 'admin:back' }]
        ]
      }
    });
    return ctx.answerCbQuery();
  }
  
  // Obnul confirm
  if (data === 'admin:obnul_confirm') {
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/obnul`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: ADMIN_SECRET })
      });
      const result = await res.json();
      if (result.ok) {
        await ctx.editMessageText('✅ Всё обнулено!', { reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] } });
      } else {
        await ctx.editMessageText(`❌ Ошибка: ${result.error}`, { reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] } });
      }
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка соединения.', { reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] } });
    }
    return ctx.answerCbQuery();
  }
  
  // Back
  if (data === 'admin:back') {
    setSession(userId, { state: 'idle', targetId: null });
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch(e) {}
    return ctx.reply('🎛 **Админ-панель KATYSHKA**\n\nВыберите действие:', mainMenu());
  }
});

bot.launch().then(() => console.log('🤖 Admin bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
