# educational-yad2-telegram-bot

> **Educational demo.** Built to show how a Telegram bot, a tiny local LLM,
> and a real-world scraper-vs-anti-bot fight fit together in one
> `docker compose` stack. Not for commercial use. Yad2's data is theirs.

Hourly Telegram bot that fetches the top apartment listing from
[yad2.co.il/realestate/rent](https://www.yad2.co.il/realestate/rent),
summarises it with a 91 MB local LLM, and posts it to a Telegram chat.

## What works

- ✅ Telegram bot harness — bidirectional, only your `chat_id` can talk to it
- ✅ Commands: `/ping`, `/help`, `/status`, `/check`, `/force`
- ✅ Local LLM (default `smollm2:135m` via Ollama) summarises listings
- ✅ Hourly scrape with ±7 min jitter and per-listing dedup
- ✅ Hostile-target scraping via ScrapingBee `stealth_proxy + render_js`
- ✅ Whole stack boots from one `docker compose up`

## What we learned the hard way

Yad2 fronts every page with Radware ShieldSquare. We tried, in order:

| Attempt                            | Result               |
| ---------------------------------- | -------------------- |
| Plain `fetch` + cheerio            | 302 → captcha page   |
| `got-scraping` (TLS fingerprinting)| 302 → captcha page   |
| Playwright headless                | Captcha page         |
| Playwright + stealth plugin        | Captcha page         |
| ScrapingBee `premium_proxy`        | Captcha page         |
| **ScrapingBee `stealth_proxy`** ✓  | Real Hebrew Yad2 HTML |

That walk is the educational point: small sites surrender to a User-Agent
flip, hardened sites need real residential rotation. The repo is the cheapest
honest end-to-end demo of that journey.

## Architecture

```
Telegram ⇄ bot (node:20-alpine) ──▶ ollama (smollm2:135m)
              │
              └──▶ ScrapingBee ──▶ yad2.co.il
```

| Service       | Purpose                                                       |
| ------------- | ------------------------------------------------------------- |
| `ollama`      | Serves the local LLM (~91 MB on disk, runs CPU-only).         |
| `ollama-pull` | One-shot init that pulls the model on first `up`.             |
| `bot`         | Schedules scrapes, parses HTML, talks to Telegram + LLM.      |

## Quick start

1. **Bot token** — message [@BotFather](https://t.me/BotFather), `/newbot`, copy the token.
2. **Chat id** — message your new bot, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `chat.id`.
3. **ScrapingBee key** — sign up free at
   <https://app.scrapingbee.com/account/register> (1000 credits, no card).
4. **Configure** —
   ```bash
   cp .env.example .env
   # fill in TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SCRAPINGBEE_API_KEY
   ```
5. **Run** —
   ```bash
   docker compose up -d --build
   docker compose logs -f bot
   ```
   Within ~20 sec a Telegram message with the top listing should arrive.
   Send `/ping` to verify the round-trip.

## Cost note

ScrapingBee `stealth_proxy + render_js` is **75 credits per call** — the only
combo that defeats Yad2. The free 1000 credits cover ~13 hourly checks.
Stretch it with `SCRAPE_INTERVAL_MIN=240` (~5 days) in `.env`.

## Tunable env

| Var                   | Default                                    |
| --------------------- | ------------------------------------------ |
| `OLLAMA_MODEL`        | `smollm2:135m` (`qwen2.5:0.5b` for better Hebrew) |
| `YAD2_URL`            | `https://www.yad2.co.il/realestate/rent`   |
| `SCRAPE_INTERVAL_MIN` | `60`                                       |
| `JITTER_MIN`          | `7`                                        |

## Caveats

- `smollm2:135m` is borderline on Hebrew; bump to `qwen2.5:0.5b` if summaries
  look broken.
- Yad2's `/realestate/rent` serves a curated **lobby** to fresh visitors —
  not strict newest-first. Override `YAD2_URL` for a focused feed.
- ScrapingBee credits are spent on every call, including failed ones.

## License

MIT, for educational use. Don't deploy this against Yad2 at scale — it's a
classroom demo, not a product.
