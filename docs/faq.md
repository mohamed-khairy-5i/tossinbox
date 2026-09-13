# FAQ

Short answers, no marketing.

Markdown version of https://tossinbox.pages.dev/faq.html

## Is it really free?

Yes. The tool is MIT-licensed and all seven upstream providers (mail.tm,
mail.gw, GuerrillaMail, tempmail.lol, temp-mail.io, tempmail.plus and
maildrop.cc) are free with no API keys. There is no paid tier and nothing to
sign up for.

## Can it send email?

No. Receive-only, by design. TossInbox exists for privacy and testing. It
deliberately ships no bulk-send or bulk-signup mode. Please respect each
provider's terms of service.

## Is a disposable inbox private?

Treat any disposable inbox as public: anyone who guesses the address could
read it. Your local state (`~/.tossinbox/state.json`, override with
`TOSSINBOX_STATE`) holds provider tokens and is written with 0600 permissions.
`toss` deletes the account on the provider when supported. Never use it for
banking, government, or your real identity.

## Does it work on Windows?

Yes. Anywhere Node.js 18+ runs.
`npx tossinbox@latest spawn` works in PowerShell exactly the
same. Homebrew covers macOS and Linux.

## How is this different from tmpmail and friends?

Most existing CLI temp-mail tools are human-first wrappers around the same
dead upstream API (1secmail now returns 403). TossInbox is agent-first from
day one: MCP server, `--json` everywhere, documented exit codes, hard
20-second request timeouts, and live providers.

## What happens to my inboxes between commands?

They are saved in a local state file so `wait`, `list` and `toss` know which
inbox to operate on. If the file is corrupted, TossInbox refuses to overwrite
it and tells you. It never silently destroys your state.

## How long does an inbox live?

Until you toss it, or until the upstream provider retires the account on its
own. Treat every inbox as short-lived: create it, receive the code, toss it,
in one session. TossInbox keeps no servers of its own; the only record is your
local `~/.tossinbox/state.json`.

## A site blocked my disposable address

Some sites keep blocklists of known disposable domains. That is their right,
and no tool can promise around it. Try another provider:
`tossinbox spawn -p tempmailio`. With seven providers, a blocked domain is
rarely the end of the round.

## How do I uninstall it?

`brew uninstall mohamed-khairy-5i/tap/tossinbox` or
`npm uninstall -g tossinbox`, then delete
`~/.tossinbox/` for the local state. Nothing was ever written anywhere else.

MIT License © 2026 Mohamed Khairy
