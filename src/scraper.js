// Node 18+ provides fetch() globally — no separate package needed

const ITEM_RE = /<item\b[\s\S]*?<\/item>/g;

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';

  let value = match[1].trim();

  const cdata = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) value = cdata[1].trim();

  return decodeEntities(value);
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&(?:#039|apos);/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)));
}

function truncate(text, maxLen) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1).trim()}…` : clean;
}

function parseRssItems(xml) {
  const blocks = xml.match(ITEM_RE) || [];

  return blocks
    .map(block => ({
      title: extractTag(block, 'title'),
      url: extractTag(block, 'link'),
      description: truncate(extractTag(block, 'description'), 150)
    }))
    .filter(item => item.title && item.url);
}

async function fetchNews(category, feedUrl, limit = 3) {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DozoNewsBot/1.0)' }
    });

    if (!response.ok) {
      throw new Error(`Feed request failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    return parseRssItems(xml).slice(0, limit);
  } catch (error) {
    console.error(`Error fetching ${category} news:`, error);
    return [];
  }
}

module.exports = fetchNews;
