require('dotenv').config();
const sendToTelegram = require('./telegram');
const fetchNews = require('./scraper');
const analyzeNews = require('./analyzer');

// Category → one or more RSS feeds. Multiple feeds in a category get merged
// before analysis (e.g. World & Latvia pulls from both BBC and LSM).
const FEEDS = {
  'AI': [
    'https://techcrunch.com/category/artificial-intelligence/feed/'
  ],
  'EVs & Tesla': [
    'https://insideevs.com/rss/articles/all/'
  ],
  'Finance': [
    'https://finance.yahoo.com/news/rssindex'
  ],
  'World & Latvia': [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://eng.lsm.lv/rss/'
  ]
};

const CATEGORY_ICONS = {
  'AI': '🤖',
  'EVs & Tesla': '⚡',
  'Finance': '📈',
  'World & Latvia': '🌍'
};

// How many raw headlines per feed get handed to the importance filter.
// The filter is expected to keep only a fraction of these.
const CANDIDATES_PER_FEED = 8;

async function collectCandidates() {
  const itemsByCategory = {};

  for (const [category, feeds] of Object.entries(FEEDS)) {
    const results = await Promise.all(
      feeds.map(feedUrl => fetchNews(category, feedUrl, CANDIDATES_PER_FEED))
    );
    itemsByCategory[category] = results.flat();
  }

  return itemsByCategory;
}

// Used if the Claude API call fails — better to send a shorter, unfiltered
// digest than to send nothing.
function fallbackCurated(candidates) {
  const out = {};
  for (const [category, items] of Object.entries(candidates)) {
    out[category] = items.slice(0, 3).map(item => ({
      category,
      title: item.title,
      url: item.url,
      summary: item.description
    }));
  }
  return out;
}

async function main() {
  try {
    console.log('🔄 Fetching news...');
    const candidates = await collectCandidates();

    console.log('🧠 Analyzing importance...');
    let curated;
    try {
      curated = await analyzeNews(candidates);
    } catch (error) {
      console.error('⚠️ Analysis failed, falling back to raw top headlines:', error.message);
      curated = fallbackCurated(candidates);
    }

    const message = formatMessage(curated);

    await sendToTelegram(message);
    console.log('✅ News sent to Telegram');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function formatSection(items) {
  if (!items || items.length === 0) return 'No strategically important updates today.';

  return items
    .map(item => {
      const lines = [`• ${item.title}`, `  ${item.url}`];
      if (item.summary) lines.push(`  ${item.summary}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatMessage(curated) {
  const sections = Object.keys(FEEDS)
    .map(category => `${CATEGORY_ICONS[category] || '•'} ${category}\n${formatSection(curated[category])}`)
    .join('\n\n');

  return `📰 Daily News Brief — ${new Date().toLocaleDateString('en-US')}\n\n${sections}`;
}

main();
