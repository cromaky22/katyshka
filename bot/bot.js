const { Telegraf } = require('telegraf');

const token = process.env.BOT_TOKEN;
if(!token){
  console.error('ERROR: BOT_TOKEN is not set. Set environment variable BOT_TOKEN and restart.');
  process.exit(1);
}

const bot = new Telegraf(token);
const WEB_URL = process.env.WEB_URL || 'https://cromaky22.github.io/katyshka/';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'obnul2026';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

bot.start((ctx) => {
  ctx.reply('Нажмите кнопку, чтобы открыть приложение:', {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Открыть KATYSHKA', web_app: { url: WEB_URL } }
      ]]
    }
  });
});

// Admin: /obnul — обнулить все балансы, ставки, промокоды
bot.command('obnul', async (ctx) => {
  try {
    const res = await fetch(`${SERVER_URL}/api/admin/obnul`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: ADMIN_SECRET })
    });
    const data = await res.json();
    if (data.ok) {
      ctx.reply('✅ Все балансы, ставки и промокоды обнулены.');
    } else {
      ctx.reply(`❌ Ошибка: ${data.error || 'неизвестная'}`);
    }
  } catch (e) {
    console.error('OBNUL error:', e);
    ctx.reply('❌ Ошибка соединения с сервером.');
  }
});

// Handle web app data
bot.on('web_app_data', async (ctx) => {
  try {
    const data = ctx.webAppData.data;
    console.log('Received web app data:', data);
    // The data contains user info from the web app
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
