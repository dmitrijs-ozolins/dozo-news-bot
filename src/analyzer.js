// Filters raw RSS candidates down to strategically important stories using
// the Claude API (Anthropic Messages API), and writes a short "why it
// matters" blurb for each story that's kept. Uses a tool-use call so the
// response comes back as structured JSON instead of free-form text.
//
// Cost note: the model is asked to return only a numeric id + summary per
// selected item, not the full title/url/category. Those get re-attached
// locally from the original candidates after the call. Output tokens are
// priced well above input tokens on Claude models, and title/url/category
// together are usually longer than the summary itself — echoing them back
// for every selected item would roughly double the output size for no
// benefit (the model doesn't need to see or reproduce a url to judge
// whether a story matters), so they're kept out of the tool schema
// entirely. As a side effect, this also removes any risk of the model
// subtly mangling a long tracking-parameter-laden url when copying it.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001'; // cheapest current Claude tier — plenty for classification + a one-line summary

const SELECT_TOOL = {
  name: 'select_important_news',
  description: 'Select only the strategically important news items, by id, and explain why each one matters.',
  input_schema: {
    type: 'object',
    properties: {
      selected: {
        type: 'array',
        description: 'The chosen items, most important first. Can be empty if nothing is significant today.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'The [id] of the candidate being selected' },
            summary: {
              type: 'string',
              description: '1-2 sentence, punchy explanation of why this is strategically significant — not a repeat of the original description'
            }
          },
          required: ['id', 'summary']
        }
      }
    },
    required: ['selected']
  }
};

// Assigns a flat, globally unique id to every candidate across all
// categories, and returns both the id-annotated groups (for the prompt)
// and a lookup map (for re-attaching title/url/category after the call).
function indexCandidates(itemsByCategory) {
  let nextId = 0;
  const indexed = {};
  const byId = new Map();

  for (const [category, items] of Object.entries(itemsByCategory)) {
    indexed[category] = items.map(item => {
      const id = nextId++;
      byId.set(id, { category, title: item.title, url: item.url });
      return { id, title: item.title, description: item.description };
    });
  }

  return { indexed, byId };
}

function buildPrompt(indexed) {
  const blocks = Object.entries(indexed).map(([category, items]) => {
    const lines = items.map(item => {
      const parts = [`[${item.id}] ${item.title}`];
      if (item.description) parts.push(`    ${item.description}`);
      return parts.join('\n');
    });
    return `## ${category}\n${lines.join('\n')}`;
  });

  return `You're curating a daily news brief for a fullstack developer who wants signal, not noise.

From the candidate headlines below, select ONLY items that reflect strategically important developments: major product launches, funding/M&A, regulatory or policy shifts, market-moving events, significant geopolitical or economic news.

Skip routine reviews, listicles, "best of" roundups, minor incremental stories, and pure recaps.

It's fine to select nothing from a category if nothing there is genuinely significant today — don't pad the list just to fill it.

For each selected item, return its [id] and write a punchy 1-2 sentence summary of *why it matters strategically* — don't just restate the original description.

Candidates:

${blocks.join('\n\n')}`;
}

async function analyzeNews(itemsByCategory) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  const { indexed, byId } = indexCandidates(itemsByCategory);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024, // right-sized for id + one-line summary per selected item; billing is by actual tokens used, not this ceiling
      tools: [SELECT_TOOL],
      tool_choice: { type: 'tool', name: 'select_important_news' },
      messages: [{ role: 'user', content: buildPrompt(indexed) }]
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
  for (const sel of toolUse.input.selected || []) {
    const original = byId.get(sel.id);
    if (!original) continue; // guard against a hallucinated/out-of-range id

    if (!byCategory[original.category]) byCategory[original.category] = [];
    byCategory[original.category].push({
      category: original.category,
      title: original.title,
      url: original.url,
      summary: sel.summary
    });
  }
  return byCategory;
}

module.exports = analyzeNews;
