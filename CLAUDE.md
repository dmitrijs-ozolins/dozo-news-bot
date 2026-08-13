# 📰 Telegram Daily News Bot — Claude Guide

## Project Overview

**Purpose:** Automated daily news briefing sent to Telegram at 8:00 AM UTC+3 (6:00 UTC)  
**Stack:** Node.js + GitHub Actions + Telegram Bot API  
**Cost:** ~$0/month (GitHub Actions free tier)  
**Owner:** Dimaaa (Latvia-based fullstack developer)

---

## 🏗️ Architecture

```
news-bot/
├── .github/workflows/
│   └── daily-news.yml              ← Cron scheduler (runs daily at 6:00 UTC)
├── src/
│   ├── index.js                    ← Main entry point (orchestrates news fetch + send)
│   ├── telegram.js                 ← Telegram API client
│   ├── scraper.js                  ← Web scraping & news aggregation
│   └── formatter.js                ← Message formatting (Markdown)
├── .env.example                    ← Template for environment variables
├── .gitignore                      ← Excludes .env & node_modules
├── package.json                    ← Dependencies: node-fetch, dotenv
├── claude.md                       ← This file
└── README.md                       ← User-facing documentation
```

---

## ⚙️ Environment Setup

### Required Environment Variables

```env
# .env (DO NOT COMMIT THIS FILE)
TELEGRAM_TOKEN=<token>
TELEGRAM_CHAT_ID=<user-will-provide>
SCHEDULE_TIME=08:00
NODE_ENV=production
```

### GitHub Secrets (Used in CI/CD)

Store these in **Settings → Secrets and variables → Actions**:

- `TELEGRAM_TOKEN` — Telegram Bot API token (@BotFather)
- `TELEGRAM_CHAT_ID` — Target Telegram chat/channel ID

⚠️ **Security Note:** Never commit `.env` to Git. Use `.env.example` as template.

---

## 📅 Scheduling Details

**GitHub Actions Cron:** `0 6 * * 1-5` (UTC timezone)

| Cron | Time UTC | Time UTC+3 | Days |
|------|----------|-----------|------|
| `0 6 * * 1-5` | 06:00 | 08:00 | Mon-Fri |
| `0 6 * * *` | 06:00 | 08:00 | Daily |

**Current Setting:** Weekdays only (Mon-Fri)  
**To change:** Edit `.github/workflows/daily-news.yml` line 5

---

## 🤖 Core Functionality

### 1. **index.js** — Orchestration

```javascript
// Workflow:
// 1. Parse environment variables
// 2. Fetch news from 3 categories (AI, EV, Finance)
// 3. Format message as Markdown
// 4. Send to Telegram
// 5. Log results / handle errors
```

**Key Functions:**
- `main()` — Entry point
- `formatMessage(aiNews, evNews, finNews)` — Markdown formatting
- Error handling with process exit codes

### 2. **telegram.js** — Telegram API Client

```javascript
// sendToTelegram(message)
// - POST to api.telegram.org/bot{TOKEN}/sendMessage
// - parse_mode: 'Markdown' (supports *bold*, _italic_, [link](url))
// - Returns: Promise<TelegramResponse>
```

**Endpoint:** `https://api.telegram.org/bot{TOKEN}/sendMessage`

**Payload:**
```json
{
  "chat_id": "CHAT_ID",
  "text": "Message content",
  "parse_mode": "Markdown",
  "disable_web_page_preview": false
}
```

### 3. **scraper.js** — News Aggregation

```javascript
// fetchNews(category, url)
// Currently: Stub implementation (returns hardcoded news)
// Future: Use web_search API or RSS feeds
```

**News Sources (To Configure):**
- **AI:** aiweekly.co, techstartups.com
- **EV:** insideevs.com, notateslaapp.com, electrek.co
- **Finance:** finance.yahoo.com, cnbc.com, bloomberg.com

### 4. **formatter.js** — Message Layout

**Format:**
```
📰 *Daily News Brief* — August 6, 2026

🤖 *Artificial Intelligence*
• [Headline](url)
  Short description (2-3 lines)

⚡ *Electric Vehicles*
• [Headline](url)
  Short description

📈 *Finance & Markets*
• [Headline](url)
  Short description
```

---

## 🚀 How to Modify This Project

### Adding a New News Category

**File:** `src/scraper.js`

```javascript
// 1. Add new fetch function
async function fetchTechNews(url) {
  return await fetchNews('Tech', url);
}

// 2. Update index.js
const techNews = await fetchTechNews('https://...');

// 3. Add to message formatting
📱 *Technology*
${techNews.map(n => `• [${n.title}](${n.url})\n  ${n.description}`).join('\n\n')}
```

### Changing Notification Time

**File:** `.github/workflows/daily-news.yml`

```yaml
# Line 5: Modify cron expression
- cron: '30 7 * * *'  # New time: 07:30 UTC (09:30 UTC+3)
```

### Switching to Daily (7 days/week)

```yaml
- cron: '0 6 * * *'  # Remove '1-5' → runs every day
```

### Adding More News Sources

**File:** `src/scraper.js`

```javascript
const NEWS_SOURCES = {
  AI: [
    'https://aiweekly.co/ai-news-today',
    'https://techstartups.com',
    'https://theinformation.com'  // New source
  ],
  EV: [...],
  Finance: [...]
};
```

### Improving Web Scraping

Current implementation is a stub. To enable real scraping, install **cheerio** or **jsdom**:

```bash
npm install cheerio
```

Then in `scraper.js`:

```javascript
const cheerio = require('cheerio');

async function fetchNews(category, url) {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const news = [];
  $('article').slice(0, 3).each((i, elem) => {
    news.push({
      title: $(elem).find('h2').text(),
      url: $(elem).find('a').attr('href'),
      description: $(elem).find('p').text().substring(0, 150)
    });
  });
  return news;
}
```

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

# Run script
npm start
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing TELEGRAM_TOKEN` | Secret not set in GitHub | Add to Secrets in repo Settings |
| `Telegram API error: 401` | Invalid token | Regenerate token via @BotFather |
| `Telegram API error: 400` | Invalid chat_id | Get correct chat_id (should be number or negative) |
| `Cannot read property 'map'` | News array is null | Check scraper returns valid data |
| `GitHub Actions job fails silently` | Check `.env` in Actions logs | Ensure secrets are properly named |

### Enable Verbose Logging

**File:** `src/index.js`

```javascript
console.log('🔍 Fetching from:', newsUrl);
console.log('📦 Received news:', JSON.stringify(news, null, 2));
console.log('📨 Sending message:', message);
```

---

## 📊 Performance Considerations

- **Execution time:** ~5-30 seconds (depends on network latency)
- **GitHub Actions timeout:** 6 hours (ample for this use case)
- **Free tier limit:** 2,000 minutes/month (this bot uses ~0.5 minutes/day)
- **Telegram API rate limit:** 30 msg/sec per account (not an issue)

---

## 🔐 Security & Best Practices

1. **Never hardcode secrets** → Use GitHub Secrets + .env locally
2. **Validate Telegram responses** → Check `response.ok` before processing
3. **Error handling** → Catch and log errors, exit with code 1 on failure
4. **Keep dependencies updated** → Run `npm audit fix` regularly
5. **Limit message retries** → Don't spam Telegram if it fails

---

## 📋 Testing Checklist

Before deploying to production:

- [ ] Local test with `.env` file works
- [ ] GitHub Secrets are properly named and populated
- [ ] Workflow YAML syntax is valid (GitHub Actions pre-checks)
- [ ] Manual trigger works (Actions → Run workflow)
- [ ] Telegram message arrives with correct formatting
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
  "node-fetch": "^3.3.0",      // HTTP requests
  "dotenv": "^16.0.0",         // Load .env variables
  "cheerio": "^1.0.0"          // HTML parsing (optional)
}
```

---

## 🚀 Deployment Commands

```bash
# Initial setup
npm install
git add .
git commit -m "Initial commit: daily news bot"
git push origin main

# Update code
git add src/
git commit -m "Update scraper with new sources"
git push origin main

# Update GitHub Secrets (via GUI only, no CLI)
# Go to Settings → Secrets and variables → Actions → Update
```

---

## 📞 Support & Debugging

**Need help with:**

1. **Adding new news sources?** → Modify `src/scraper.js`
2. **Changing schedule?** → Edit `.github/workflows/daily-news.yml`
3. **Telegram formatting issues?** → Check Markdown syntax in `src/formatter.js`
4. **GitHub Actions not running?** → Check secrets, YAML syntax, commit to main branch
5. **Want to test locally?** → Create `.env` and run `npm start`

---

## 📄 Files Reference

| File | Purpose | Edit by |
|------|---------|---------|
| `src/index.js` | Main logic | Developer |
| `src/telegram.js` | Telegram API | Developer |
| `src/scraper.js` | News fetching | Developer |
| `.github/workflows/daily-news.yml` | Schedule & CI/CD | Developer |
| `.env.example` | Env template | Version control |
| `package.json` | Dependencies | Developer |
| `.gitignore` | Git exclusions | Version control |

---

**Last Updated:** August 6, 2026  
**Maintained by:** Dimaaa  
**Status:** Active & Running ✅