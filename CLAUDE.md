# 📰 Telegram Daily News Bot — Claude Guide

## Project Overview

**Purpose:** Automated daily news briefing sent to Telegram at 8:00 AM UTC+3 (6:00 UTC)
**Stack:** Node.js (native `fetch`) + GitHub Actions + Telegram Bot API
**Cost:** ~$0/month (GitHub Actions free tier)
**Owner:** Dimaaa (Latvia-based fullstack developer)

---

## 🏗️ Architecture

```
news-bot/
├── .github/workflows/
│   └── daily-news.yml              ← Cron scheduler (runs daily at 6:00 UTC)
├── src/
│   ├── index.js                    ← Main entry point (orchestrates news fetch + send, formats the message)
│   ├── telegram.js                 ← Telegram API client
│   └── scraper.js                  ← RSS-based news aggregation
├── .env.example                    ← Template for environment variables
├── .gitignore                      ← Excludes .env & node_modules
├── package.json                    ← Dependencies: dotenv
├── CLAUDE.md                       ← This file
└── README.md                       ← User-facing documentation
```

Note: message formatting lives inside `src/index.js` (`formatMessage`/`formatSection`) — there's no separate `formatter.js`.

---

## ⚙️ Environment Setup

### Required Environment Variables

```env
# .env (DO NOT COMMIT THIS FILE)
TELEGRAM_TOKEN=<your-bot-token-from-BotFather>
TELEGRAM_CHAT_ID=<user-will-provide>
NODE_ENV=production
```

### GitHub Secrets (Used in CI/CD)

Store these in **Settings → Secrets and variables → Actions**:

- `TELEGRAM_TOKEN` — Telegram Bot API token (@BotFather)
- `TELEGRAM_CHAT_ID` — Target Telegram chat/channel ID

⚠️ **Security Note:** Never commit `.env` (or a real token pasted anywhere else in the repo, including this file) to Git. Use `.env.example` as template.

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

### 1. **index.js** — Orchestration + formatting

```javascript
// Workflow:
// 1. Load environment variables (dotenv)
// 2. Fetch news from 3 RSS feeds (AI, EV, Finance) via scraper.js
// 3. Format message as Telegram HTML (formatMessage / formatSection / escapeHtml)
// 4. Send to Telegram
// 5. Log results / handle errors, process.exit(1) on failure
```

**Key parts:**
- `FEEDS` — map of category → RSS feed URL
- `main()` — entry point
- `formatMessage(aiNews, evNews, finNews)` / `formatSection(news)` — builds the HTML message; empty categories render "No updates today."
- `escapeHtml(str)` — escapes `&`, `<`, `>` before interpolating into Telegram HTML (titles/descriptions come from external RSS and must not be trusted as-is)

### 2. **telegram.js** — Telegram API Client

```javascript
// sendToTelegram(message)
// - POST to api.telegram.org/bot{TOKEN}/sendMessage
// - parse_mode: 'HTML' (supports <b>bold</b>, <a href="url">text</a>)
// - Returns: Promise<TelegramResponse>
```

**Endpoint:** `https://api.telegram.org/bot{TOKEN}/sendMessage`

**Payload:**
```json
{
  "chat_id": "CHAT_ID",
  "text": "Message content (HTML)",
  "parse_mode": "HTML",
  "disable_web_page_preview": false
}
```

⚠️ Uses `parse_mode: 'HTML'`, not legacy `Markdown` — real headline text often contains `_ * [ ] ( )`, which breaks Telegram's Markdown entity parser and makes `sendMessage` fail with `400: can't parse entities`. HTML only needs 3 characters escaped (`& < >`), which `escapeHtml` handles for every value pulled from RSS before it goes into the message.

### 3. **scraper.js** — RSS-based news aggregation

```javascript
// fetchNews(category, feedUrl, limit = 3)
// - fetch()es the RSS feed, extracts <item> blocks with a lightweight regex parser
//   (no xml/cheerio dependency — feeds are well-formed RSS 2.0)
// - decodes HTML/XML entities (including numeric entities like &#8217;) and CDATA
// - truncates description to ~150 chars
// - returns [{ title, url, description }], best-effort: fetch errors return []
```

**Current news sources (`FEEDS` in `index.js`):**
- **AI:** `https://techcrunch.com/category/artificial-intelligence/feed/`
- **EV:** `https://insideevs.com/rss/articles/all/`
- **Finance:** `https://finance.yahoo.com/news/rssindex`

RSS was chosen over HTML scraping (cheerio/jsdom) because these sites are far more likely to keep a stable RSS structure than a scrapeable DOM — a lot of finance sites (Yahoo, Bloomberg, CNBC) render article listings via JS and don't expose headlines in the raw HTML at all.

### 4. Message Format

Telegram HTML output (rendered by `formatMessage`/`formatSection` in `index.js`):

```
📰 <b>Daily News Brief</b> — 8/13/2026

🤖 <b>AI</b>
• <a href="...">Headline</a>
  Short description (~150 chars)

⚡ <b>EVs & Tesla</b>
• <a href="...">Headline</a>
  Short description

📈 <b>Finance</b>
• <a href="...">Headline</a>
```

(Finance items from the Yahoo feed have no `<description>`, so those lines are headline-only — this is expected, not a bug.)

---

## 🚀 How to Modify This Project

### Adding a New News Category

**File:** `src/index.js`

```javascript
// 1. Add the feed URL to FEEDS
const FEEDS = {
  AI: '...',
  EV: '...',
  Finance: '...',
  Tech: 'https://example.com/feed/'
};

// 2. Fetch it in main()
const techNews = await fetchNews('Tech', FEEDS.Tech);

// 3. Add a section to formatMessage()
📱 <b>Technology</b>
${formatSection(techNews)}
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

**File:** `src/index.js` — edit the `FEEDS` map. Any well-formed RSS 2.0 feed URL works out of the box with `scraper.js`; verify with `curl` first that the feed returns `<item>` blocks with `<title>`/`<link>`.

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

# Run script (needs Node 18+ for global fetch)
npm start
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID in .env` | Secret/env var not set | Add to `.env` locally, or GitHub Secrets in Actions |
| `Telegram API error: 401` | Invalid token | Regenerate token via @BotFather |
| `Telegram API error: 400` | Invalid `chat_id`, or unescaped HTML reached Telegram | Verify chat_id; confirm `escapeHtml` wraps any new interpolated text |
| `fetch is not defined` / `ReferenceError: fetch` | Running on Node < 18 (no global fetch) | Use Node 18+ locally and in CI (workflow pins `node-version: 'lts/*'`) |
| `Feed request failed: 4xx/5xx` (logged per category, that category returns `[]`) | Source RSS URL changed or is blocking the request | Verify the feed URL still works with `curl`, update `FEEDS` in `index.js` |
| GitHub Actions job fails silently / workflow not visible in Actions tab | New workflow file wasn't indexed by GitHub yet | Push any change touching `.github/workflows/daily-news.yml`, or wait — GitHub (re)indexes workflows on push to the default branch |

### Enable Verbose Logging

**File:** `src/index.js`

```javascript
console.log('🔍 Fetching from:', feedUrl);
console.log('📦 Received news:', JSON.stringify(news, null, 2));
console.log('📨 Sending message:', message);
```

---

## 📊 Performance Considerations

- **Execution time:** ~5-30 seconds (depends on network latency to the RSS sources)
- **GitHub Actions timeout:** 6 hours (ample for this use case)
- **Free tier limit:** 2,000 minutes/month (this bot uses well under 1 minute/day)
- **Telegram API rate limit:** 30 msg/sec per account (not an issue)
- **Setup Node.js step:** pin `node-version: 'lts/*'` (not an old/uncached exact version) — `actions/setup-node` uses the runner's pre-installed toolcache for the current LTS instead of downloading a tarball, so the step stays near-instant.

---

## 🔐 Security & Best Practices

1. **Never hardcode secrets** → Use GitHub Secrets + `.env` locally, never paste a real token into this file, README, or a commit
2. **Validate Telegram responses** → Check `response.ok` before processing
3. **Escape untrusted text** → Anything from RSS (title/description/url) goes through `escapeHtml` before landing in the HTML message body
4. **Error handling** → Catch and log errors, exit with code 1 on failure
5. **Keep dependencies updated** → Run `npm audit fix` regularly
6. **Limit message retries** → Don't spam Telegram if it fails

---

## 📋 Testing Checklist

Before deploying to production:

- [ ] Local test with `.env` file works (Node 18+)
- [ ] GitHub Secrets are properly named and populated
- [ ] Workflow YAML syntax is valid and appears under the repo's Actions tab
- [ ] Manual trigger works (Actions → Run workflow)
- [ ] Telegram message arrives with correct HTML formatting (bold headers, clickable links)
- [ ] No sensitive data in logs or error messages
- [ ] Cron schedule is correct for target timezone

---

## 🎯 Future Enhancements

### Phase 2: Smart Filtering

```javascript
// Filter news by relevance score
const relevantNews = allNews.filter(n => n.relevanceScore > 0.7);
```

### Phase 3: Web Interface

```javascript
// Simple dashboard: http://localhost:3000
// Shows last 10 briefs + next scheduled run
```

### Phase 4: User Preferences

```javascript
// Store user preferences in database
// Allow customization: categories, time, frequency
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

News fetching uses Node 18+'s built-in `fetch` — no `node-fetch` dependency. RSS parsing uses a small hand-rolled regex parser in `scraper.js` — no `cheerio`/`xml2js` dependency. Add `cheerio` only if a future source requires real HTML scraping (see "If a source only offers scrapeable HTML" above).

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

1. **Adding new news sources?** → Modify `FEEDS` in `src/index.js`
2. **Changing schedule?** → Edit `.github/workflows/daily-news.yml`
3. **Telegram formatting issues?** → Check HTML tags in `formatMessage`/`formatSection` in `src/index.js`, and that new interpolated values go through `escapeHtml`
4. **GitHub Actions not running / not visible?** → Check secrets, YAML syntax, and that the workflow file has been pushed to the default branch (`master`)
5. **Want to test locally?** → Create `.env` and run `npm start` (requires Node 18+)

---

## 📄 Files Reference

| File | Purpose | Edit by |
|------|---------|---------|
| `src/index.js` | Orchestration + message formatting | Developer |
| `src/telegram.js` | Telegram API client | Developer |
| `src/scraper.js` | RSS fetching & parsing | Developer |
| `.github/workflows/daily-news.yml` | Schedule & CI/CD | Developer |
| `.env.example` | Env template | Version control |
| `package.json` | Dependencies | Developer |
| `.gitignore` | Git exclusions | Version control |

---

**Last Updated:** August 13, 2026
**Maintained by:** Dimaaa
**Status:** Active & Running ✅
