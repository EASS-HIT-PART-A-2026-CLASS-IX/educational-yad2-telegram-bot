import { fetchLatestListing } from './scraper.js';
import { summarizeListing } from './llm.js';
import { sendTelegram, pollUpdates } from './telegram.js';
import { loadSeen, saveSeen } from './state.js';

const YAD2_URL = process.env.YAD2_URL || 'https://www.yad2.co.il/realestate/rent';
const INTERVAL_MIN = Number(process.env.SCRAPE_INTERVAL_MIN || 60);
const JITTER_MIN = Number(process.env.JITTER_MIN || 7);

let lastTickAt = null;
let busy = false;

// Escape user-controlled text before placing it inside Telegram HTML.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function tick({ force = false } = {}) {
  if (busy) {
    console.log('tick: already running, skipping');
    return { skipped: 'busy' };
  }
  busy = true;
  try {
    const startedAt = new Date().toISOString();
    lastTickAt = startedAt;
    console.log(`[${startedAt}] checking ${YAD2_URL}`);

    let listing;
    try {
      listing = await fetchLatestListing(YAD2_URL);
    } catch (err) {
      console.error('scrape failed:', err.message);
      return { error: err.message };
    }

    if (!listing) {
      console.log('no listing extracted this tick');
      return { empty: true };
    }

    const seen = await loadSeen();
    if (seen.has(listing.id) && !force) {
      console.log(`already sent listing ${listing.id}`);
      return { duplicate: listing.id, listing };
    }

    let summary;
    try {
      summary = await summarizeListing(listing.snippet);
    } catch (err) {
      console.error('llm failed:', err.message);
      summary = listing.snippet.slice(0, 240);
    }

    const message =
      `🏠 <b>${force ? 'Top Yad2 listing' : 'New Yad2 listing'}</b>\n` +
      `${escapeHtml(summary)}\n\n` +
      `<a href="${escapeHtml(listing.url)}">פתח מודעה / open listing</a>`;

    try {
      await sendTelegram(message);
      seen.add(listing.id);
      await saveSeen(seen);
      console.log(`sent listing ${listing.id}`);
      return { sent: listing.id };
    } catch (err) {
      console.error('telegram failed:', err.message);
      return { error: err.message };
    }
  } finally {
    busy = false;
  }
}

function scheduleNext() {
  // Jitter [-JITTER_MIN .. +JITTER_MIN] minutes so we don't hit the site
  // at the same wall-clock minute every hour.
  const jitterMs = (Math.random() * 2 - 1) * JITTER_MIN * 60_000;
  const delay = Math.max(60_000, INTERVAL_MIN * 60_000 + jitterMs);
  console.log(`next check in ${(delay / 60_000).toFixed(1)} min`);
  setTimeout(loop, delay);
}

async function loop() {
  await tick();
  scheduleNext();
}

const HELP =
  'commands:\n' +
  '/check — force a fetch now (still sends only if new)\n' +
  '/force — fetch now and send even if already seen\n' +
  '/status — last check + seen count\n' +
  '/ping — am I alive';

async function handleCommand(text) {
  const cmd = text.trim().split(/\s+/)[0].toLowerCase();
  // Silently ignore anything that is not a slash command.
  if (!cmd.startsWith('/')) return;

  switch (cmd) {
    case '/start':
    case '/help':
      await sendTelegram(HELP);
      return;
    case '/ping':
      await sendTelegram('pong');
      return;
    case '/status': {
      const seen = await loadSeen();
      await sendTelegram(
        `last check: ${lastTickAt ?? 'never'}\n` +
        `seen ids: ${seen.size}\n` +
        `busy: ${busy}`
      );
      return;
    }
    case '/check': {
      if (busy) { await sendTelegram('already checking — hold on'); return; }
      await sendTelegram('checking now…');
      const r = await tick();
      if (r?.skipped) await sendTelegram(`skipped: ${r.skipped}`);
      else if (r?.empty) await sendTelegram('no listing extracted (site may be challenging us)');
      else if (r?.duplicate) await sendTelegram(`top listing unchanged: ${r.duplicate}`);
      else if (r?.error) await sendTelegram(`error: ${r.error}`);
      return;
    }
    case '/force': {
      if (busy) { await sendTelegram('already checking — hold on'); return; }
      await sendTelegram('forcing fetch + send…');
      const r = await tick({ force: true });
      if (r?.skipped) await sendTelegram(`skipped: ${r.skipped}`);
      else if (r?.empty) await sendTelegram('no listing extracted');
      else if (r?.error) await sendTelegram(`error: ${r.error}`);
      return;
    }
    default:
      await sendTelegram(`unknown command. ${HELP}`);
  }
}

pollUpdates(handleCommand).catch((err) => {
  console.error('poller crashed:', err);
  process.exit(1);
});

// Small startup delay so Ollama/model pull settles even after healthcheck.
setTimeout(loop, 5_000);
