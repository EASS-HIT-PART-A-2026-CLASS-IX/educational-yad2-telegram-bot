# educational-yad2-telegram-bot

Hourly Telegram bot that watches [yad2.co.il/realestate/rent](https://www.yad2.co.il/realestate/rent)
for new apartment listings, summarises each one with a tiny local LLM, and
pushes it to a Telegram chat. Everything except the anti-bot proxy runs
locally in `docker compose`.

> **Educational demo.** Yad2 fronts every page with Radware ShieldSquare —
> plain `fetch`, plain Playwright, and even Playwright + stealth plugin all
> get the captcha page. The free 1000-credit tier of
> [ScrapingBee](https://www.scrapingbee.com/)'s `stealth_proxy` is what
> actually defeats it. The interesting parts of this repo are the parts that
> don't depend on that: the docker harness, the local LLM, the Telegram
> command loop, dedup, and the polite scheduler.

## Stack

| Service       | What it does                                                                |
| ------------- | --------------------------------------------------------------------------- |
| `ollama`      | Serves a tiny local LLM (default `smollm2:135m`, ~91 MB) for summaries.     |
| `ollama-pull` | One-shot helper that pulls the model on first `up`.                         |
| `bot`         | Node 20 alpine. `fetch` → ScrapingBee → cheerio parse → Ollama → Telegram.  |

Image footprint: bot ~50 MB, ollama ~700 MB, model ~91 MB.

Politeness baked in:

- one ScrapingBee call per tick
- 60 min interval ± 7 min jitter
- dedup by listing ID, so the same flat is never re-sent
- only your `TELEGRAM_CHAT_ID` is allowed to talk to the bot

## Bot commands (from Telegram)

| Command   | Effect                                              |
| --------- | --------------------------------------------------- |
| `/ping`   | Bot replies `pong` — verifies the harness.          |
| `/help`   | Prints command list.                                |
| `/status` | Last check time, seen-id count, busy flag.          |
| `/check`  | Force a fetch now. Sends only if listing is new.    |
| `/force`  | Fetch now and send even if already seen.            |

## Setup

### 1. Create a Telegram bot (~1 min)

1. Open Telegram, search **@BotFather**, send `/newbot`.
2. Pick a name (e.g. `Yad2 Watcher`) and a unique username ending in `bot`.
3. Copy the token from BotFather's reply.
4. Open a chat with your new bot and send `hi` (any message will do).
5. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser —
   find `"chat":{"id":NUMBER,...}` and copy that number.

### 2. Get a ScrapingBee API key (free)

Register at <https://app.scrapingbee.com/account/register> — 1000 free
credits, no credit card. Copy the key from the dashboard.

### 3. Configure

```bash
cp .env.example .env
# edit .env, set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SCRAPINGBEE_API_KEY
```

### 4. Run

```bash
docker compose up -d --build
docker compose logs -f bot
```

Within ~20 sec of the first tick you should see something like:

```
fetching https://www.yad2.co.il/realestate/rent via ScrapingBee
got 1024636 bytes; head: <!DOCTYPE html><html dir="rtl" lang="he">...
sent listing dwqitnt0
next check in 56.0 min
```

…and a Telegram message in your bot chat.

## Cost note

ScrapingBee's `stealth_proxy + render_js` mode is **75 credits per call** —
the only combo that defeats Yad2's ShieldSquare. The free tier (1000 credits)
covers about 13 hourly checks. To stretch it:

- `SCRAPE_INTERVAL_MIN=240` → check every 4 hours (~5 days free demo).
- `SCRAPE_INTERVAL_MIN=720` → twice a day (~16 days).

## Tuning

All knobs live in `.env`:

| Var                   | Default                                    | Notes                                              |
| --------------------- | ------------------------------------------ | -------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`  | —                                          | required                                           |
| `TELEGRAM_CHAT_ID`    | —                                          | required                                           |
| `SCRAPINGBEE_API_KEY` | —                                          | required (unless you replace the scraper)          |
| `OLLAMA_MODEL`        | `smollm2:135m`                             | `smollm2:360m` or `qwen2.5:0.5b` for better text   |
| `YAD2_URL`            | `https://www.yad2.co.il/realestate/rent`   | swap in a filtered URL (city / rooms / price)      |
| `SCRAPE_INTERVAL_MIN` | `60`                                       | minutes between checks                             |
| `JITTER_MIN`          | `7`                                        | ± minutes added to each interval                   |

## Project layout

```
.
├── docker-compose.yml      # ollama + ollama-pull + bot
├── .env.example            # template for secrets
├── README.md
└── bot/
    ├── Dockerfile          # node:20-alpine
    ├── package.json        # cheerio only
    └── src/
        ├── index.js        # scheduler + Telegram command loop
        ├── scraper.js      # ScrapingBee fetch + cheerio parse
        ├── llm.js          # Ollama /api/generate client
        ├── telegram.js     # sendMessage + long-poll getUpdates
        └── state.js        # JSON-file dedup cache
```

## Caveats

- The 135M LLM is borderline on Hebrew — if summaries look broken, bump
  `OLLAMA_MODEL` to `qwen2.5:0.5b` (still ~400 MB) and restart `bot`.
- Yad2's `/realestate/rent` returns a "lobby" variant to fresh visitors with
  curated recommendations rather than strict newest-first. For truer
  freshness, override `YAD2_URL` with something like
  `/realestate/rent?propertyGroup=apartments,houses` or a city-specific URL.
- ScrapingBee credits are spent on every call, including ones that come back
  empty. The scraper logs the response size and HTML head so you can spot a
  bad day on the proxy.

## License

MIT — see `LICENSE` if/when added.
