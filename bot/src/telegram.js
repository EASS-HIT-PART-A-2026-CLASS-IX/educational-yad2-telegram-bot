const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegram(text) {
  if (!TOKEN || !CHAT_ID) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  }

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      disable_web_page_preview: false,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  }
}

// Long-poll getUpdates. Only forwards messages from the configured chat_id —
// anyone else who finds the bot is silently ignored.
export async function pollUpdates(onMessage) {
  if (!TOKEN || !CHAT_ID) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  }

  let offset = 0;
  while (true) {
    try {
      const url = `https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=30&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`getUpdates ${res.status}: ${await res.text()}`);
        await new Promise((r) => setTimeout(r, 5_000));
        continue;
      }
      const { result = [] } = await res.json();
      for (const update of result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg?.text) continue;
        if (String(msg.chat.id) !== String(CHAT_ID)) continue;
        try {
          await onMessage(msg.text, msg);
        } catch (err) {
          console.error('command handler failed:', err.message);
        }
      }
    } catch (err) {
      console.error('poll error:', err.message);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
}
