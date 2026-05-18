import * as cheerio from 'cheerio';

const ITEM_LINK_RE = /\/realestate\/item\/[^/]+\/([A-Za-z0-9]+)/;
const SCRAPINGBEE_KEY = process.env.SCRAPINGBEE_API_KEY;

// ScrapingBee does the anti-bot dance for us. Yad2 specifically requires
// the stealth_proxy tier — we tested classic and premium and both still hit
// ShieldSquare captcha. Only stealth_proxy + render_js returned real HTML.
//
// Credit cost on the free 1000-credit tier:
//   render_js=true + stealth_proxy=true = 75 credits per call
//   → ~13 hourly checks before the free tier exhausts.
// Reduce frequency (SCRAPE_INTERVAL_MIN=240 for every 4 hours) to stretch it.
export async function fetchLatestListing(url) {
  if (!SCRAPINGBEE_KEY) {
    throw new Error('SCRAPINGBEE_API_KEY not set in .env');
  }

  console.log(`fetching ${url} via ScrapingBee`);

  const params = new URLSearchParams({
    api_key: SCRAPINGBEE_KEY,
    url,
    render_js: 'true',
    stealth_proxy: 'true',
    country_code: 'il',
  });

  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`ScrapingBee ${res.status}: ${body}`);
  }
  const html = await res.text();

  console.log(`got ${html.length} bytes; head: ${html.slice(0, 120).replace(/\s+/g, ' ')}`);

  // The real Yad2 page also embeds a ShieldSquare beacon script for normal
  // tracking, so substring matching on "ShieldSquare" false-positives.
  // The actual block page has <title>ShieldSquare Captcha</title>.
  const isCaptcha =
    /<title>\s*ShieldSquare\s*Captcha\s*<\/title>/i.test(html) ||
    /are you a human/i.test(html);

  if (html.length < 5_000 || isCaptcha) {
    throw new Error('bot-challenge page returned');
  }

  const $ = cheerio.load(html);

  // Yad2 serves a "lobby" variant of /realestate/rent to fresh visitors
  // with curated recommendations rather than a strict newest-first feed.
  // We accept whatever the first non-script item link is — for a stricter
  // newest-first list, override YAD2_URL with something like
  // /realestate/rent?propertyGroup=apartments,houses
  const seen = new Set();
  const candidates = [];
  $('a[href*="/realestate/item/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || seen.has(href)) return;
    seen.add(href);
    // Skip the next.js chunk preload links that match /item/ in their path.
    if (href.includes('_next/')) return;

    const card = $(el).closest('li, article, [data-testid]');
    const text = (card.text() || $(el).text()).trim().replace(/\s+/g, ' ');

    candidates.push({ href, text });
  });

  if (candidates.length === 0) {
    console.warn('no listing links found in HTML');
    return null;
  }

  const first = candidates[0];
  const idMatch = first.href.match(ITEM_LINK_RE);
  const id = idMatch?.[1] ?? first.href;
  const absoluteUrl = new URL(first.href, url).toString();

  return {
    id,
    url: absoluteUrl,
    snippet: first.text.slice(0, 600),
    fetchedAt: new Date().toISOString(),
  };
}
