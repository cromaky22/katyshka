const { Telegraf } = require('telegraf');

const token = process.env.BOT_TOKEN;
  if(!token){ console.error('BOT_TOKEN not set'); process.exit(1); }
const bot = new Telegraf(token);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const startParam = ctx.startPayload;

  try {
    const userData = {
      id: String(userId),
      first_name: ctx.from.first_name || null,
      last_name: ctx.from.last_name || null,
      username: ctx.from.username || null,
    };

    if (startParam && startParam !== String(userId)) {
      userData.referredBy = startParam;
      console.log(`[REF] User ${userId} referred by ${startParam}`);
    }

    await fetch(`${SERVER_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
  } catch (e) {
    console.error('[BOT] Reg error:', e.message);
  }

  await ctx.reply('🎰 **Добро пожаловать в KATYSHKA(((**\n\nНажмите кнопку ниже чтобы начать играть:', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎮 ИГРАТЬ', web_app: { url: `${SERVER_URL}/home.html` } }
      ]]
    }
  });
});

bot.launch().then(() => console.log('🤖 Casino bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
