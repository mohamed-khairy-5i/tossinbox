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

## Next up

Ordered by how likely they are to land first. Small, verifiable increments.

| item | status | why |
|------|--------|-----|
| `mail.gw` provider | planned | mail.tm-compatible API — the cheapest possible provider win |
| `tempmail.lol` provider | planned | free API, adds a third independent upstream |
| Provider failover | planned | auto-retry spawn/wait on the next provider when one is down |
| `tossinbox watch` | planned | live-polling mode that prints codes as they arrive — no exit until Ctrl-C |
| Attachments & HTML bodies | planned | `read` gains decoded HTML and downloadable attachments |
| More OTP languages | planned | wider extraction coverage beyond English + Arabic prompts |

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
