require('dotenv').config();
const sendToTelegram = require('./telegram');
const fetchNews = require('./scraper');

async function main() {
  try {
    console.log('🔄 Fetching news...');
    
    // Gather news from different sources
    const aiNews = await fetchNews('AI', 'https://aiweekly.co/ai-news-today');
    const evNews = await fetchNews('EV', 'https://insideevs.com/');
    const finNews = await fetchNews('Finance', 'https://finance.yahoo.com/');

    // Format the message
    const message = formatMessage(aiNews, evNews, finNews);

    // Send to Telegram
    await sendToTelegram(message);
    console.log('✅ News sent to Telegram');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function formatMessage(aiNews, evNews, finNews) {
  return `
📰 *Daily News Brief* — ${new Date().toLocaleDateString('en-US')}

🤖 *AI*
${aiNews.map(n => `• [${n.title}](${n.url})\n  ${n.description}`).join('\n\n')}

⚡ *EVs & Tesla*
${evNews.map(n => `• [${n.title}](${n.url})\n  ${n.description}`).join('\n\n')}

📈 *Finance*
${finNews.map(n => `• [${n.title}](${n.url})\n  ${n.description}`).join('\n\n')}
  `.trim();
}

main();