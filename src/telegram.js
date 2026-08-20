// Node 18+ provides fetch() globally — no separate package needed

async function sendToTelegram(message) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    throw new Error('Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID in .env');
  }
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      // Plain text: no parse_mode. Telegram auto-linkifies raw URLs on its
      // own, so headlines don't need HTML/Markdown markup, and arbitrary
      // RSS text can never break entity parsing.
      disable_web_page_preview: true
    })
  });
  
  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.statusText}`);
  }
  
  return response.json();
}

module.exports = sendToTelegram;