# 📰 Telegram Daily News Bot — Claude Guide

## Project Overview

**Purpose:** Automated daily news briefing sent to Telegram at 8:00 AM UTC+3 (6:00 UTC) — curated for strategic importance, not a raw headline dump
**Stack:** Node.js (native `fetch`) + GitHub Actions + Telegram Bot API + Claude API (Anthropic) for importance filtering
**Cost:** ~$0/month GitHub Actions (free tier) + a small per-run Claude API cost (single Haiku call/day)
**Owner:** Dimaaa (Latvia-based fullstack developer)

---

## 🏗️ Architecture

```
news-bot/
├── .github/workflows/
│   └── daily-news.yml              ← Cron scheduler (runs weekdays at 6:00 UTC)
├── src/
│   ├── index.js                    ← Entry point: collects candidates, calls analyzer, formats, sends
│   ├── scraper.js                  ← RSS-based news aggregation
│   ├── analyzer.js                 ← Claude API call that filters candidates down to important stories
│   └── telegram.js                 ← Telegram API client
├── .env.example                    ← Template for environment variables
├── .gitignore                      ← Excludes .env & node_modules
├── package.json                    ← Dependencies: dotenv
├── CLAUDE.md                       ← This file
└── README.md                       ← User-facing documentation
```

Note: message formatting lives inside `src/index.js` (`formatMessage`/`formatSection`) — there's no separate `formatter.js`.

### Pipeline

```
RSS feeds (5 feeds, 4 categories)
  → scraper.js: parse, ~8 raw candidates per feed
  → analyzer.js: single Claude API call, filters to strategically important items + "why it matters"
  → index.js: formats plain-text digest
  → telegram.js: sends to chat
```

---

## ⚙️ Environment Setup

### Required Environment Variables

```env
# .env (DO NOT COMMIT THIS FILE)
TELEGRAM_TOKEN=<your-bot-token-from-BotFather>
TELEGRAM_CHAT_ID=<user-will-provide>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
NODE_ENV=production
```

### GitHub Secrets (Used in CI/CD)

Store these in **Settings → Secrets and variables → Actions**:

- `TELEGRAM_TOKEN` — Telegram Bot API token (@BotFather)
- `TELEGRAM_CHAT_ID` — Target Telegram chat/channel ID
- `ANTHROPIC_API_KEY` — Anthropic API key, used by `analyzer.js` to filter for importance

⚠️ **Security Note:** Never commit `.env` (or a real token/key pasted anywhere else in the repo, including this file) to Git. Use `.env.example` as template.

---

## 📅 Scheduling Details

**GitHub Actions Cron:** `0 6 * * 1-5` (UTC timezone)

| Cron | Time UTC | Time UTC+3 | Days |
|------|----------|-----------|------|
| `0 6 * * 1-5` | 06:00 | 08:00 | Mon-Fri |
| `0 6 * * *` | 06:00 | 08:00 | Daily |

**Current Setting:** Weekdays only (Mon-Fri)
**To change:** Edit `.github/workflows/daily-news.yml`, the `schedule.cron` value

---

## 🤖 Core Functionality

### 1. **scraper.js** — RSS-based news aggregation

```javascript
// fetchNews(category, feedUrl, limit = 3)
// - fetch()es the RSS feed, extracts <item> blocks with a lightweight regex parser
//   (no xml/cheerio dependency — feeds are well-formed RSS 2.0)
// - decodes HTML/XML entities: standard ones, numeric entities (&#8217;),
//   and &nbsp;/&mdash;/&hellip; (LSM's feed double-encodes some of these as
//   &amp;nbsp; — decodeEntities handles that after the &amp; pass)
// - truncates description to ~150 chars
// - returns [{ title, url, description }], best-effort: fetch errors return []
```

**Current news sources (`FEEDS` in `index.js`):**
- **AI:** `https://techcrunch.com/category/artificial-intelligence/feed/`
- **EVs & Tesla:** `https://insideevs.com/rss/articles/all/`
- **Finance:** `https://finance.yahoo.com/news/rssindex`
- **World & Latvia:** `https://feeds.bbci.co.uk/news/world/rss.xml` + `https://eng.lsm.lv/rss/` (merged into one category)

RSS was chosen over HTML scraping (cheerio/jsdom) because these sites are far more likely to keep a stable RSS structure than a scrapeable DOM — a lot of finance sites (Yahoo, Bloomberg, CNBC) render article listings via JS and don't expose headlines in the raw HTML at all.

`leta.lv` (originally requested) has no public RSS feed (no auto-discovery, no feed at common paths — it's a commercial wire service) — `eng.lsm.lv` (Latvian Public Broadcasting) was used instead for Latvia coverage.

### 2. **analyzer.js** — Importance filtering via Claude API

```javascript
// analyzeNews(itemsByCategory)
// - one Messages API call to Claude (model: claude-haiku-4-5-20251001)
// - uses tool_choice to force a structured `select_important_news` tool call,
//   so the response is guaranteed-shape JSON, not free text to parse
// - prompt instructs: keep only strategically important stories (major
//   launches, funding/M&A, regulatory/policy shifts, market-moving or
//   significant geopolitical/economic news); skip reviews, listicles,
//   routine recaps; empty result for a category is fine
// - each kept item gets a punchy 1-2 sentence "why it matters" summary,
//   written by the model — not the original RSS description
// - throws on missing ANTHROPIC_API_KEY or a non-2xx API response
```

**Fallback:** if the analyzer call throws (missing/invalid key, API error, malformed response), `index.js` catches it and falls back to the top 3 raw RSS items per category (`fallbackCurated`) — the bot still sends a digest that day instead of failing outright. Check the Action logs for `⚠️ Analysis failed` to know when this happened.

### 3. **index.js** — Orchestration + formatting

```javascript
// Workflow:
// 1. Load environment variables (dotenv)
// 2. collectCandidates(): fetch ~8 raw items per feed across all categories (scraper.js)
// 3. analyzeNews(candidates): filter to important items (analyzer.js), or
//    fallbackCurated() if that call fails
// 4. formatMessage(curated): build the plain-text digest
// 5. sendToTelegram(message)
// 6. Log results / handle errors, process.exit(1) on failure
```

**Key parts:**
- `FEEDS` — map of category → array of RSS feed URLs (categories can merge multiple feeds)
- `CATEGORY_ICONS` — emoji per category header
- `CANDIDATES_PER_FEED` (8) — raw items pulled per feed before filtering
- `formatMessage(curated)` / `formatSection(items)` — builds the plain-text message; empty categories render "No strategically important updates today."

### 4. **telegram.js** — Telegram API Client

```javascript
// sendToTelegram(message)
// - POST to api.telegram.org/bot{TOKEN}/sendMessage
// - no parse_mode: plain text — Telegram auto-linkifies raw URLs on its own
// - disable_web_page_preview: true (digest has several links per message;
//   a single big preview thumbnail from just the first link isn't useful here)
// - Returns: Promise<TelegramResponse>
```

Plain text was chosen deliberately over HTML/Markdown: arbitrary RSS/LLM-generated text can contain any character, and with no `parse_mode` there's nothing to escape and nothing that can break `sendMessage` with a `400: can't parse entities` error.

### 5. Message Format

```
📰 Daily News Brief — 8/14/2026

🤖 AI
• Headline
  https://...
  Why this matters (1-2 sentences, from the analyzer)

⚡ EVs & Tesla
No strategically important updates today.

📈 Finance
• Headline
  https://...
  Why this matters

🌍 World & Latvia
• Headline
  https://...
  Why this matters
```

Category order and headers come from `FEEDS`/`CATEGORY_ICONS` in `index.js`.

---

## 🚀 How to Modify This Project

### Adding a New News Category

**File:** `src/index.js`

```javascript
// 1. Add feed(s) to FEEDS (array, even for a single feed)
const FEEDS = {
  'AI': [...],
  'EVs & Tesla': [...],
  'Finance': [...],
  'World & Latvia': [...],
  'Technology': ['https://example.com/feed/']
};

// 2. Add an icon
const CATEGORY_ICONS = {
  ...
  'Technology': '📱'
};

// That's it — collectCandidates()/analyzeNews()/formatMessage() all iterate FEEDS.
```

### Changing Notification Time

**File:** `.github/workflows/daily-news.yml`

```yaml
# Modify the cron expression under `schedule:`
- cron: '30 7 * * *'  # New time: 07:30 UTC (09:30 UTC+3)
```

### Switching to Daily (7 days/week)

```yaml
- cron: '0 6 * * *'  # Remove '1-5' → runs every day
```

### Adding/Changing RSS Sources

**File:** `src/index.js` — edit the `FEEDS` map (each category is an array of feed URLs, merged). Any well-formed RSS 2.0 feed URL works out of the box with `scraper.js`; verify with `curl` first that the feed returns `<item>` blocks with `<title>`/`<link>`, and check for auto-discovery (`<link rel="alternate" type="application/rss+xml">`) if a site's obvious `/rss/` paths 404.

### Tuning the importance filter

**File:** `src/analyzer.js` — edit the prompt text in `buildPrompt()`. It's plain English instructions to the model, not code — e.g. to bias toward/away from certain topics, change what counts as "strategically important," or adjust how many sentences the summary should be.

### If a source only offers scrapeable HTML (no RSS)

Install `cheerio` and add a separate code path in `scraper.js` for that source — don't force everything through the RSS parser. Keep RSS as the default since it's far more stable.

---

## 🔧 Debugging & Troubleshooting

### View Workflow Logs

1. Go to **GitHub repo → Actions tab**
2. Click latest workflow run
3. Check **Run news bot** step for output

### Test Locally

```bash
# Install dependencies
npm install

# Create .env file with your secrets
echo "TELEGRAM_TOKEN=your_token" > .env
echo "TELEGRAM_CHAT_ID=your_chat_id" >> .env
echo "ANTHROPIC_API_KEY=your_key" >> .env

# Run script (needs Node 18+ for global fetch)
npm start
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID in .env` | Secret/env var not set | Add to `.env` locally, or GitHub Secrets in Actions |
| `Telegram API error: 401` | Invalid token | Regenerate token via @BotFather |
| `Telegram API error: 400` | Invalid `chat_id` | Verify `TELEGRAM_CHAT_ID` — message body itself is plain text, so it can't cause a parse error |
| `fetch is not defined` / `ReferenceError: fetch` | Running on Node < 18 (no global fetch) | Use Node 18+ locally and in CI (workflow pins `node-version: 'lts/*'`) |
| `Feed request failed: 4xx/5xx` (logged per category, that feed contributes `[]`) | Source RSS URL changed or is blocking the request | Verify the feed URL still works with `curl`, update `FEEDS` in `index.js` |
| `⚠️ Analysis failed, falling back to raw top headlines: Missing ANTHROPIC_API_KEY` | Secret not set | Add `ANTHROPIC_API_KEY` to `.env` / GitHub Secrets |
| `⚠️ Analysis failed ...: Anthropic API error: 401/429/...` | Bad/expired key, or rate-limited | Check the key in the Anthropic console; digest still sends via the raw-headline fallback |
| GitHub Actions job fails silently / workflow not visible in Actions tab | New workflow file wasn't indexed by GitHub yet | Push any change touching `.github/workflows/daily-news.yml`, or wait — GitHub (re)indexes workflows on push to the default branch |

### Enable Verbose Logging

**File:** `src/index.js`

```javascript
console.log('🔍 Fetching from:', feedUrl);
console.log('📦 Candidates:', JSON.stringify(candidates, null, 2));
console.log('🧠 Curated:', JSON.stringify(curated, null, 2));
console.log('📨 Sending message:', message);
```

---

## 📊 Performance Considerations

- **Execution time:** ~5-30 seconds fetching feeds, plus one Claude API call (~2-5s)
- **GitHub Actions timeout:** 6 hours (ample for this use case)
- **Free tier limit:** 2,000 Actions minutes/month (this bot uses well under 1 minute/day)
- **Telegram API rate limit:** 30 msg/sec per account (not an issue)
- **Claude API cost:** one Haiku call/day with ~20-30 candidate headlines — a small fraction of a cent per run
- **Setup Node.js step:** pin `node-version: 'lts/*'` (not an old/uncached exact version) — `actions/setup-node` uses the runner's pre-installed toolcache for the current LTS instead of downloading a tarball, so the step stays near-instant.

---

## 🔐 Security & Best Practices

1. **Never hardcode secrets** → Use GitHub Secrets + `.env` locally, never paste a real token/key into this file, README, or a commit
2. **Validate Telegram responses** → Check `response.ok` before processing
3. **Plain text output** → No `parse_mode`, so there's no entity-escaping risk from RSS or LLM-generated text
4. **Error handling** → Catch and log errors, exit with code 1 on failure; analyzer failures degrade gracefully instead of blocking the send
5. **Keep dependencies updated** → Run `npm audit fix` regularly
6. **Limit message retries** → Don't spam Telegram if it fails

---

## 📋 Testing Checklist

Before deploying to production:

- [ ] Local test with `.env` file works (Node 18+, all three secrets set)
- [ ] GitHub Secrets are properly named and populated (`TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `ANTHROPIC_API_KEY`)
- [ ] Workflow YAML syntax is valid and appears under the repo's Actions tab
- [ ] Manual trigger works (Actions → Run workflow)
- [ ] Telegram message arrives — headlines, clickable links, "why it matters" summaries
- [ ] Categories with nothing important show "No strategically important updates today." instead of being empty/missing
- [ ] No sensitive data in logs or error messages
- [ ] Cron schedule is correct for target timezone

---

## 🎯 Future Enhancements

### Phase 3: Web Interface

```javascript
// Simple dashboard: http://localhost:3000
// Shows last 10 briefs + next scheduled run
```

### Phase 4: User Preferences

```javascript
// Store user preferences in database
// Allow customization: categories, time, frequency, importance threshold
```

### Phase 5: Multi-User Support

```javascript
// Send to multiple channels/users
// Track delivery status
```

---

## 📚 Dependencies

```json
{
  "dotenv": "^16.0.0"      // Load .env variables locally
}
```

News fetching and the Claude API call both use Node 18+'s built-in `fetch` — no `node-fetch` or `@anthropic-ai/sdk` dependency. RSS parsing uses a small hand-rolled regex parser in `scraper.js` — no `cheerio`/`xml2js` dependency. Add `cheerio` only if a future source requires real HTML scraping (see "If a source only offers scrapeable HTML" above).

---

## 🚀 Deployment Commands

```bash
# Initial setup
npm install
git add .
git commit -m "..."
git push origin master

# Update GitHub Secrets (via GUI only, no CLI)
# Go to Settings → Secrets and variables → Actions → Update
```

Note: this repo's default branch is `master`, not `main`.

---

## 📞 Support & Debugging

**Need help with:**

1. **Adding new news sources?** → Modify `FEEDS`/`CATEGORY_ICONS` in `src/index.js`
2. **Changing schedule?** → Edit `.github/workflows/daily-news.yml`
3. **Tuning what counts as "important"?** → Edit the prompt in `buildPrompt()` in `src/analyzer.js`
4. **Telegram formatting issues?** → Message is plain text (`formatMessage`/`formatSection` in `src/index.js`) — no markup to get wrong
5. **GitHub Actions not running / not visible?** → Check secrets, YAML syntax, and that the workflow file has been pushed to the default branch (`master`)
6. **Want to test locally?** → Create `.env` (all three vars) and run `npm start` (requires Node 18+)

---

## 📄 Files Reference

| File | Purpose | Edit by |
|------|---------|---------|
| `src/index.js` | Orchestration + message formatting | Developer |
| `src/scraper.js` | RSS fetching & parsing | Developer |
| `src/analyzer.js` | Claude API importance filtering | Developer |
| `src/telegram.js` | Telegram API client | Developer |
| `.github/workflows/daily-news.yml` | Schedule & CI/CD | Developer |
| `.env.example` | Env template | Version control |
| `package.json` | Dependencies | Developer |
| `.gitignore` | Git exclusions | Version control |

---

**Last Updated:** August 14, 2026
**Maintained by:** Dimaaa
**Status:** Active & Running ✅
