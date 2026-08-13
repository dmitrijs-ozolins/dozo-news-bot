require('dotenv').config();
const sendToTelegram = require('./telegram');
const fetchNews = require('./scraper');

const FEEDS = {
  AI: 'https://techcrunch.com/category/artificial-intelligence/feed/',
  EV: 'https://insideevs.com/rss/articles/all/',
  Finance: 'https://finance.yahoo.com/news/rssindex'
};

async function main() {
  try {
    console.log('🔄 Fetching news...');

    // Gather news from different sources
    const aiNews = await fetchNews('AI', FEEDS.AI);
    const evNews = await fetchNews('EV', FEEDS.EV);
    const finNews = await fetchNews('Finance', FEEDS.Finance);

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatSection(news) {
  if (news.length === 0) return 'No updates today.';

  return news
    .map(n => {
      const title = escapeHtml(n.title);
      const url = escapeHtml(n.url);
      const line = `• <a href="${url}">${title}</a>`;
      return n.description ? `${line}\n  ${escapeHtml(n.description)}` : line;
    })
    .join('\n\n');
}

function formatMessage(aiNews, evNews, finNews) {
  return `
📰 <b>Daily News Brief</b> — ${new Date().toLocaleDateString('en-US')}

🤖 <b>AI</b>
${formatSection(aiNews)}

⚡ <b>EVs & Tesla</b>
${formatSection(evNews)}

📈 <b>Finance</b>
${formatSection(finNews)}
  `.trim();
}

main();
