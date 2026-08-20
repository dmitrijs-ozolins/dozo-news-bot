// Filters raw RSS candidates down to strategically important stories using
// the Claude API (Anthropic Messages API), and writes a short "why it
// matters" blurb for each story that's kept. Uses a tool-use call so the
// response comes back as structured JSON instead of free-form text.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const SELECT_TOOL = {
  name: 'select_important_news',
  description: 'Select only the strategically important news items from the candidates and explain why each one matters.',
  input_schema: {
    type: 'object',
    properties: {
      selected: {
        type: 'array',
        description: 'The chosen items, most important first. Can be empty for a category with nothing significant today.',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            title: { type: 'string', description: 'Original headline, lightly cleaned up if needed' },
            url: { type: 'string' },
            summary: {
              type: 'string',
              description: '1-2 sentence, punchy explanation of why this is strategically significant — not a repeat of the original description'
            }
          },
          required: ['category', 'title', 'url', 'summary']
        }
      }
    },
    required: ['selected']
  }
};

function buildPrompt(itemsByCategory) {
  const blocks = Object.entries(itemsByCategory).map(([category, items]) => {
    const lines = items.map((item, i) => {
      const parts = [`${i + 1}. ${item.title}`];
      if (item.description) parts.push(`   ${item.description}`);
      parts.push(`   URL: ${item.url}`);
      return parts.join('\n');
    });
    return `## ${category}\n${lines.join('\n')}`;
  });

  return `You're curating a daily news brief for a fullstack developer who wants signal, not noise.

From the candidate headlines below, select ONLY items that reflect strategically important developments: major product launches, funding/M&A, regulatory or policy shifts, market-moving events, significant geopolitical or economic news.

Skip routine reviews, listicles, "best of" roundups, minor incremental stories, and pure recaps.

It's fine to select nothing from a category if nothing there is genuinely significant today — don't pad the list just to fill it.

For each selected item, write a punchy 1-2 sentence summary of *why it matters strategically* — don't just restate the original description. Keep the category and url fields exactly as given.

Candidates:

${blocks.join('\n\n')}`;
}

async function analyzeNews(itemsByCategory) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      tools: [SELECT_TOOL],
      tool_choice: { type: 'tool', name: 'select_important_news' },
      messages: [{ role: 'user', content: buildPrompt(itemsByCategory) }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${body}`);
  }

  const data = await response.json();
  const toolUse = (data.content || []).find(block => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Anthropic response did not include a tool_use block');
  }

  const byCategory = {};
  for (const item of toolUse.input.selected || []) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }
  return byCategory;
}

module.exports = analyzeNews;
