# 📰 Telegram Daily News Bot

Automated daily news briefing — AI, EVs & Finance headlines — delivered to a Telegram chat every weekday morning via GitHub Actions. No server, no hosting cost.

- **Runs:** 6:00 UTC (8:00 UTC+3), Mon–Fri
- **Cost:** $0/month (GitHub Actions free tier)
- **Sources:** live RSS feeds (TechCrunch AI, InsideEVs, Yahoo Finance)

## How it works

```
GitHub Actions (cron) → fetch RSS feeds → format as Telegram HTML → send via Bot API
```

1. `.github/workflows/daily-news.yml` triggers the job on a schedule (or manually).
2. `src/scraper.js` fetches and parses each RSS feed, returning the top 3 headlines per category.
3. `src/index.js` formats everything into one HTML message.
4. `src/telegram.js` sends it to your chat/channel via the Telegram Bot API.

## Setup

### 1. Create a Telegram bot

Message [@BotFather](https://t.me/BotFather) on Telegram, run `/newbot`, and save the token it gives you.

### 2. Get your chat ID

Send any message to your new bot, then open this URL in a browser (with your token):

```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```

Find `message.chat.id` in the response — a positive number for a personal chat, negative for a group.

### 3. Configure the project

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
```

### 4. Run it locally

Requires **Node.js 18+** (uses the built-in `fetch`).

```bash
npm start
```

You should see a message land in your Telegram chat within a few seconds.

### 5. Deploy via GitHub Actions

In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `TELEGRAM_TOKEN` | Your bot token |
| `TELEGRAM_CHAT_ID` | Your chat ID |

Push to `master` — the workflow at `.github/workflows/daily-news.yml` picks it up automatically. To test it without waiting for the schedule, go to **Actions → Daily News Briefing → Run workflow**.

## Customizing

| Want to... | Edit |
|---|---|
| Change the schedule/time | `.github/workflows/daily-news.yml` (`cron` value) |
| Run every day instead of weekdays | Change `0 6 * * 1-5` → `0 6 * * *` |
| Add/change news sources | `FEEDS` map in `src/index.js` — any RSS 2.0 feed URL works |
| Change how many headlines per category | `limit` argument to `fetchNews()` in `src/index.js` (default 3) |
| Change message formatting | `formatMessage` / `formatSection` in `src/index.js` |

See [CLAUDE.md](CLAUDE.md) for a deeper technical walkthrough and troubleshooting guide.

## Project structure

```
├── .github/workflows/daily-news.yml   Scheduler (GitHub Actions cron)
├── src/
│   ├── index.js                       Orchestration + message formatting
│   ├── scraper.js                     RSS fetching & parsing
│   └── telegram.js                    Telegram Bot API client
├── .env.example                       Env var template
└── package.json
```

## License

Personal project — no license specified.
