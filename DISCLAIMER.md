# Disclaimer

This repository is provided **strictly for educational purposes**. It is a
classroom-style demonstration of how a Telegram bot, a small local LLM, and
a web-scraping pipeline can be composed in Docker. It is not affiliated
with, endorsed by, or sponsored by Yad2, Radware, ScrapingBee, Telegram,
or Ollama.

## Before you run or fork this code

1. **Read Yad2's Terms of Use and `robots.txt`.**
   Available at <https://www.yad2.co.il/> and
   <https://www.yad2.co.il/robots.txt>. Automated access to Yad2 may be
   restricted or prohibited by those terms. You are responsible for
   understanding and complying with them in your jurisdiction.

2. **Get explicit permission for anything beyond personal study.**
   Running this code against Yad2 — or any third-party site — at scale,
   commercially, in production, or for resale of data, is outside the
   intended scope of this repository and may breach the site's terms,
   applicable laws (including Israel's Computer Law, GDPR, CFAA, etc.),
   or both.

3. **Respect the target's resources.** The default scrape cadence here is
   intentionally low (once per hour, with jitter). Do not lower it
   aggressively, do not run multiple parallel copies, and do not remove
   the dedup/politeness guards.

4. **Comply with ScrapingBee's Terms of Service.** ScrapingBee's stealth
   proxy is what makes this demo work; its acceptable-use policy applies
   to you. See <https://www.scrapingbee.com/terms-and-conditions/>.

5. **Don't ship secrets.** Telegram bot tokens and ScrapingBee keys live
   in `.env`, which is gitignored. If you commit one by mistake, revoke
   it immediately.

## No warranty

The code is provided "AS IS", without warranty of any kind, express or
implied, including but not limited to the warranties of merchantability,
fitness for a particular purpose, and noninfringement. The authors and
contributors are not liable for any claim, damages, account suspension,
banning, legal action, or other liability arising from the use of this
software.

## Educational scope

What this repo is meant to teach:

- Composing a multi-service Docker stack (HTTP service, LLM service, app).
- Running a tiny local LLM (`smollm2:135m`) and calling it over HTTP.
- A bidirectional Telegram bot loop (long-poll `getUpdates` + `sendMessage`).
- The realistic difficulty curve of scraping a commercial site that uses
  enterprise anti-bot tooling (Radware ShieldSquare). Specifically: why
  plain `fetch`, TLS-fingerprinting clients, and even stealth-patched
  headless browsers may not be enough, and how third-party proxy services
  bridge that gap.

If your use case isn't one of those, this repo isn't the right tool.

By using this repository you agree that you have read and accepted this
disclaimer.
