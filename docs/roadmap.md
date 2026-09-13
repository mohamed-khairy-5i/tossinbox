# Roadmap

What shipped, what is next, and how it gets prioritized. No dates on this page
— items move when they are **done**, and changelog entries are the only source
of truth for what actually landed. Requests? Open an issue:
https://github.com/mohamed-khairy-5i/tossinbox/issues

Markdown version of https://tossinbox.pages.dev/roadmap.html

## Shipped

- **v0.1.0** — CLI + stdio MCP server, `--json` everywhere, documented exit
  codes 0–4, mail.tm + GuerrillaMail providers, OTP extraction (English +
  Arabic), GitHub Action, Homebrew tap, npm package, this website.
- **v0.1.1** — MCP bin-symlink launch fix, exit code 4 contract enforced, hard
  20s request timeouts, loud corrupt-state errors, uppercase OTP codes,
  crypto-random credentials.
- **site** — examples + guide + changelog + roadmap pages, Arabic homepage,
  Markdown-for-agents on every page, automated Cloudflare Pages deploy from CI.
- **v0.1.2** — friendly network error messages (DNS, refused, TLS, timeout each
  say what to do), atomic state saves a crash can no longer truncate.
- **site v2** — brew/npx hero tabs, Star-on-GitHub CTA, highlighted comparison
  column, EN/AR nav toggle, Arabic quickstart, Arabic copy polish.
- **v0.1.3** — third provider `mailgw` (mail.tm-compatible, independent
  infrastructure), `tossinbox watch` live-polling mode with NDJSON output for
  agents, OTP keywords in twelve languages.
- **v0.1.4** — four more zero-config providers: `tempmaillol`, `tempmailio`
  (server-side toss), `tempmailplus` and `maildrop` — seven upstreams across
  four independent stacks; temp-mail.io's transient post-create 400 now retries.
- **v0.1.5** — provider failover: when the requested provider is down
  (network error, 5xx, 429), `spawn` retries the create against the remaining
  providers automatically and reports the switch in human output, `--json`, and
  the MCP `create_inbox` tool; `--no-failover` opts out.
- **v0.1.6** — attachments & HTML bodies: `read` lists a message's attachments
  (name, size, type), `--save [dir]` downloads them with the HTML/plain-text
  bodies into `<dir>/<message-id>/` (`saved` array in JSON), `--html` prints
  the raw HTML body; the MCP `read_message` tool gains attachment metadata and
  an optional `save_dir`; tempmailplus message ids, senders and timestamps
  fixed.

## Next up

Nothing scheduled — the core loop is complete. Missing something? Open an
issue: https://github.com/mohamed-khairy-5i/tossinbox/issues

## Exploring

Ideas with open questions — tell us which ones matter to you.

- **Homebrew core** — `brew install tossinbox` without the tap, once community
  adoption justifies the review process.
- **Custom domain** — this site moving from tossinbox.pages.dev to a dedicated
  domain for branding and SEO.
- **MCP resources & prompts** — expose inbox state as MCP resources so agents
  can subscribe instead of poll.
- **Webhook output** — POST the verification code to your endpoint the moment
  it lands, for long-running automation.

TossInbox follows semver. Breaking CLI/JSON changes will not happen inside a
minor release — scripts written today keep working.

MIT License © 2026 Mohamed Khairy
