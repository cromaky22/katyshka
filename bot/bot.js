const { Telegraf } = require('telegraf');

const token = process.env.BOT_TOKEN;
if(!token){
  console.error('ERROR: BOT_TOKEN is not set. Set environment variable BOT_TOKEN and restart.');
  process.exit(1);
}

const bot = new Telegraf(token);
const WEB_URL = process.env.WEB_URL || 'https://cromaky22.github.io/katyshka/';

bot.start((ctx) => {
  ctx.reply('Нажмите кнопку, чтобы открыть приложение:', {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Открыть KATYSHKA', web_app: { url: WEB_URL } }
      ]]
    }
  });
});

bot.launch().then(() => console.log('Bot started'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
