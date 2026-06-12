const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');

const token = '8990571924:AAEmFncvswq59dZAJ727_eS5yo2bVoj5LYA';
const bot = new Telegraf(token);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'obnul2026';
const WEB_URL = process.env.WEB_URL || 'https://cromaky22.github.io/katyshka/';

// Admin sessions: userId -> { state: 'idle'|'give_id'|'give_amount'|'take_id'|'take_amount'|'set_id'|'set_amount', targetId: '...' }
const adminSessions = new Map();

function isAdmin(ctx) {
  const s = adminSessions.get(ctx.from.id);
  return s && s.authenticated;
}

function mainMenu(ctx) {
  if (isAdmin(ctx)) {
    return bot.telegram.sendMessage(ctx.chat.id, '🎛 **Админ-панель KATYSHKA**\n\nВыберите действие:', {
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
    });
  }
  return ctx.reply('🎰 **KATYSHKA** — Админ-бот\n\nВведите пароль для доступа:', { parse_mode: 'Markdown' });
}

// === START ===
bot.start((ctx) => {
  adminSessions.set(ctx.from.id, { authenticated: true, state: 'idle' });
  mainMenu(ctx);
});

// Password check via text
bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text;
  const session = adminSessions.get(ctx.from.id);

  if (!session || !session.authenticated) {
    if (text === ADMIN_SECRET) {
      adminSessions.set(ctx.from.id, { authenticated: true, state: 'idle' });
      ctx.reply('✅ Доступ разрешён!');
      return mainMenu(ctx);
    }
    return ctx.reply('🔐 Неверный пароль.');
  }

  // Handle states
  if (session.state === 'give_id') {
    session.targetId = text.trim();
    session.state = 'give_amount';
    return ctx.reply(`💰 Введите сумму для выдачи пользователю ${session.targetId}:`);
  }

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
      session.state = 'idle';
      if (data.ok) {
        return ctx.reply(`✅ Выдано $${amount.toFixed(2)} пользователю ${session.targetId}\nТекущий баланс: $${data.balance.toFixed(2)}`, {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] }
        });
      }
      return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`);
    } catch (e) {
      session.state = 'idle';
      return ctx.reply('❌ Ошибка соединения с сервером.');
    }
  }

  if (session.state === 'take_id') {
    session.targetId = text.trim();
    session.state = 'take_amount';
    return ctx.reply(`💸 Введите сумму для списания у пользователя ${session.targetId}:`);
  }

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
      session.state = 'idle';
      if (data.ok) {
        return ctx.reply(`💸 Списано $${amount.toFixed(2)} у ${session.targetId}\nБыло: $${currentBalance.toFixed(2)}\nТекущий: $${data.balance.toFixed(2)}`, {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] }
        });
      }
      return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`);
    } catch (e) {
      session.state = 'idle';
      return ctx.reply('❌ Ошибка соединения с сервером.');
    }
  }

  if (session.state === 'set_id') {
    session.targetId = text.trim();
    session.state = 'set_amount';
    return ctx.reply(`⚡ Введите новый баланс для пользователя ${session.targetId}:`);
  }

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
      session.state = 'idle';
      if (data.ok) {
        return ctx.reply(`⚡ Баланс ${session.targetId} установлен: $${amount.toFixed(2)}`, {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] }
        });
      }
      return ctx.reply(`❌ Ошибка: ${data.error || 'unknown'}`);
    } catch (e) {
      session.state = 'idle';
      return ctx.reply('❌ Ошибка соединения с сервером.');
    }
  }

  if (session.state === 'find_id') {
    const targetId = text.trim();
    try {
      const res = await fetch(`${SERVER_URL}/api/users?id=${targetId}`);
      const data = await res.json();
      session.state = 'idle';
      if (data.ok || data.balance !== undefined) {
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
      return ctx.reply(`❌ Пользователь ${targetId} не найден.`);
    } catch (e) {
      session.state = 'idle';
      return ctx.reply('❌ Ошибка соединения.');
    }
  }

  if (session.state === 'addme_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Неверная сумма.');
    try {
      const myId = String(ctx.from.id);
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
      session.state = 'idle';
      if (data.ok) {
        return ctx.reply(`💰✅ Баланс пополнен!\n\nБыло: $${currentBalance.toFixed(2)}\nДобавлено: $${amount.toFixed(2)}\nИтого: $${data.balance.toFixed(2)}`, {
          reply_markup: { inline_keyboard: [[{ text: 'Назад', callback_data: 'admin:back' }]] }
        });
      }
      return ctx.reply(`❌ Ошибка: ${data.error}`);
    } catch (e) {
      session.state = 'idle';
      return ctx.reply('❌ Ошибка соединения.');
    }
  }
});

// === CALLBACK HANDLER ===
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  if (!data.startsWith('admin:')) return;

  const session = adminSessions.get(userId);
  if (!session || !session.authenticated) {
    return ctx.answerCbQuery('🔐 Введите пароль.');
  }

  // Quick give/take from user search
  if (data.startsWith('admin:quick_give:')) {
    const targetId = data.split(':')[2];
    session.state = 'give_amount';
    session.targetId = targetId;
    await ctx.answerCbQuery();
    return ctx.reply(`💰 Введите сумму для выдачи пользователю ${targetId}:`);
  }

  if (data.startsWith('admin:quick_take:')) {
    const targetId = data.split(':')[2];
    session.state = 'take_amount';
    session.targetId = targetId;
    await ctx.answerCbQuery();
    return ctx.reply(`💸 Введите сумму для списания у пользователя ${targetId}:`);
  }

  if (data === 'admin:stats') {
    try {
      const res = await fetch(`${SERVER_URL}/api/users`);
      const users = await res.json();
      const totalUsers = Array.isArray(users) ? users.length : 0;
      const totalBalance = Array.isArray(users) ? users.reduce((s, u) => s + (u.balance || 0), 0).toFixed(2) : '0.00';
      await ctx.editMessageText(`📊 **Статистика**\n\n👥 Пользователей: ${totalUsers}\n💰 Общий баланс: $${totalBalance}`, {
        parse_mode: 'Markdown',
        reply_markup: backKeyboard()
      });
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка загрузки.');
    }
    return ctx.answerCbQuery();
  }

  if (data === 'admin:users') {
    try {
      const res = await fetch(`${SERVER_URL}/api/users`);
      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) {
        await ctx.editMessageText('Пользователей пока нет.', { reply_markup: backKeyboard() });
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
        await ctx.editMessageText(msg, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      }
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка.', { reply_markup: backKeyboard() });
    }
    return ctx.answerCbQuery();
  }

  if (data.startsWith('admin:user:')) {
    const targetId = data.split(':')[2];
    try {
      const res = await fetch(`${SERVER_URL}/api/users?id=${targetId}`);
      const u = await res.json();
      const name = u.first_name || u.username || targetId;
      const bal = (u.balance || 0).toFixed(2);
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

  if (data.startsWith('admin:quick_set:')) {
    const targetId = data.split(':')[2];
    session.state = 'set_amount';
    session.targetId = targetId;
    await ctx.answerCbQuery();
    return ctx.reply(`⚡ Введите новый баланс для ${targetId}:`);
  }

  if (data === 'admin:give') {
    session.state = 'give_id';
    await ctx.answerCbQuery();
    return ctx.reply('💰 Введите ID пользователя:');
  }

  if (data === 'admin:take') {
    session.state = 'take_id';
    await ctx.answerCbQuery();
    return ctx.reply('💸 Введите ID пользователя:');
  }

  if (data === 'admin:set') {
    session.state = 'set_id';
    await ctx.answerCbQuery();
    return ctx.reply('⚡ Введите ID пользователя:');
  }

  if (data === 'admin:find') {
    session.state = 'find_id';
    await ctx.answerCbQuery();
    return ctx.reply('🔍 Введите ID пользователя для поиска:');
  }

  if (data === 'admin:addme') {
    session.state = 'addme_amount';
    await ctx.answerCbQuery();
    return ctx.reply(`💰➕ Введите сумму для пополнения вашего баланса (ID: ${ctx.from.id}):`);
  }

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

  if (data === 'admin:obnul_confirm') {
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/obnul`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: ADMIN_SECRET })
      });
      const result = await res.json();
      if (result.ok) {
        await ctx.editMessageText('✅ Всё обнулено!', { reply_markup: backKeyboard() });
      } else {
        await ctx.editMessageText(`❌ Ошибка: ${result.error}`, { reply_markup: backKeyboard() });
      }
    } catch (e) {
      await ctx.editMessageText('❌ Ошибка соединения.', { reply_markup: backKeyboard() });
    }
    return ctx.answerCbQuery();
  }

  if (data === 'admin:back') {
    session.state = 'idle';
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch(e) {}
    return mainMenu(ctx);
  }

  if (data === 'admin:logout') {
    session.authenticated = false;
    session.state = 'idle';
    await ctx.editMessageText('🚪 Вы вышли. Введите пароль для повторного входа.');
    return ctx.answerCbQuery();
  }
});

function backKeyboard() {
  return { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin:back' }]] };
}

bot.launch().then(() => console.log('🤖 Admin bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
