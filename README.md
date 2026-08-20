# 📰 Telegram Daily News Bot

Automated daily news briefing — AI, EVs, Finance, and World & Latvia news — delivered to a Telegram chat every weekday morning via GitHub Actions. Curated for strategic importance by Claude, not a raw headline dump. No server, no hosting cost.

- **Runs:** 6:00 UTC (8:00 UTC+3), Mon–Fri
- **Cost:** $0/month GitHub Actions (free tier) + a small per-run Claude API cost
- **Sources:** live RSS feeds — TechCrunch AI, InsideEVs, Yahoo Finance, BBC World, LSM (Latvia)

## How it works

```
GitHub Actions (cron) → fetch RSS feeds → Claude filters for importance → plain-text digest → send via Bot API
```

1. `.github/workflows/daily-news.yml` triggers the job on a schedule (or manually).
2. `src/scraper.js` fetches and parses each RSS feed (~8 raw candidates per feed).
3. `src/analyzer.js` sends the candidates to the Claude API, which keeps only strategically important stories (major launches, funding/M&A, regulatory shifts, market-moving or significant world/Latvia news) and writes a short "why it matters" for each. Reviews, listicles, and routine recaps get dropped.
4. `src/index.js` formats the result into one plain-text message (no HTML/Markdown — Telegram auto-links raw URLs).
5. `src/telegram.js` sends it to your chat/channel via the Telegram Bot API.

If the Claude call fails for any reason, the bot falls back to sending the top 3 raw headlines per category instead of skipping the send entirely.

## Setup

### 1. Create a Telegram bot

Message [@BotFather](https://t.me/BotFather) on Telegram, run `/newbot`, and save the token it gives you.

### 2. Get your chat ID

Send any message to your new bot, then open this URL in a browser (with your token):

```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```

Find `message.chat.id` in the response — a positive number for a personal chat, negative for a group.

### 3. Get an Anthropic API key

Create one at [console.anthropic.com](https://console.anthropic.com/) — used for the importance-filtering step.

### 4. Configure the project

```bash
git clone https://github.com/dmitrijs-ozolins/dozo-news-bot.git
cd dozo-news-bot
npm install
cp .env.example .env
```

Fill in `.env`:

```env
TELEGRAM_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 5. Run it locally

Requires **Node.js 18+** (uses the built-in `fetch`).

```bash
npm start
```

You should see a curated message land in your Telegram chat within ~10-30 seconds.

### 6. Deploy via GitHub Actions

In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `TELEGRAM_TOKEN` | Your bot token |
| `TELEGRAM_CHAT_ID` | Your chat ID |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

Push to `master` — the workflow at `.github/workflows/daily-news.yml` picks it up automatically. To test it without waiting for the schedule, go to **Actions → Daily News Briefing → Run workflow**.

## Customizing

| Want to... | Edit |
|---|---|
| Change the schedule/time | `.github/workflows/daily-news.yml` (`cron` value) |
| Run every day instead of weekdays | Change `0 6 * * 1-5` → `0 6 * * *` |
| Add/change news sources or categories | `FEEDS` / `CATEGORY_ICONS` in `src/index.js` — any RSS 2.0 feed URL works, categories can merge multiple feeds |
| Change how many raw candidates feed the importance filter | `CANDIDATES_PER_FEED` in `src/index.js` (default 8) |
| Change what counts as "important" | The prompt in `buildPrompt()` in `src/analyzer.js` — it's plain English instructions |
| Change message formatting | `formatMessage` / `formatSection` in `src/index.js` |

See [CLAUDE.md](CLAUDE.md) for a deeper technical walkthrough and troubleshooting guide.

## Project structure

```
├── .github/workflows/daily-news.yml   Scheduler (GitHub Actions cron)
├── src/
│   ├── index.js                       Orchestration + message formatting
│   ├── scraper.js                     RSS fetching & parsing
│   ├── analyzer.js                    Claude API importance filtering
│   └── telegram.js                    Telegram Bot API client
├── .env.example                       Env var template
└── package.json
```

## License

Personal project — no license specified.
