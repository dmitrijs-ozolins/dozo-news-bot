// Node 18+ provides fetch() globally — no separate package needed

async function fetchNews(category, url) {
  try {
    const response = await fetch(url);
    const html = await response.text();

    // Parse HTML and look for news items
    // (This is a simplified stub — a real implementation needs cheerio or jsdom)
    
    return [
      {
        title: `Latest ${category} News`,
        url: url,
        description: `Top stories in ${category} today`
      }
    ];
  } catch (error) {
    console.error(`Error fetching ${category} news:`, error);
    return [];
  }
}

module.exports = fetchNews;