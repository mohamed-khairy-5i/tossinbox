# TossInbox — Disposable Email CLI & MCP Server for AI Agents

<p align="center">
  <img src="docs/logo.png" width="140" alt="TossInbox logo: an envelope tossed into a trash bin">
</p>

**Disposable email inboxes for humans and AI agents. Spawn a temporary inbox, wait for the OTP verification code, toss it.**

[![CI](https://github.com/mohamed-khairy-5i/tossinbox/actions/workflows/ci.yml/badge.svg)](https://github.com/mohamed-khairy-5i/tossinbox/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-34d399.svg)
![MCP](https://img.shields.io/badge/MCP-server-222a39.svg)

> **Built by [Mohamed Khairy](https://github.com/mohamed-khairy-5i).**
> If TossInbox saved you a signup form, consider starring the repo — it helps more people find it.

TossInbox is a temp-mail CLI and MCP server: it creates a brand-new throwaway
email address in one command, waits for the email verification to land, extracts
the OTP code, and deletes the inbox when you are done — server-side and locally.
Use it for signups, QA email flows, and test automation — or let your **AI
agent** do all of it through the built-in **MCP server**. No sign-up, no ads,
no browser, no API keys. Humans read the output; agents parse the `--json`.

<a href="https://tossinbox.pages.dev/"><strong>Website & docs → tossinbox.pages.dev</strong></a>

## Demo

```text
$ tossinbox spawn
✔ Inbox ready : qwd6996p1lbc@uberip.com
  provider    : mailtm

$ tossinbox wait --code --from noreply@github.com --timeout 120
✔ Verify your device
  from : GitHub <noreply@github.com>
  code : 9378412

$ tossinbox toss
✔ tossed qwd6996p1lbc@uberip.com
```

## Why TossInbox

- **For humans** — stop exposing your real address to every signup form.
- **For agents** — built agent-first from day one:
  - `--json` output on every command
  - documented exit codes, no interactive prompts
  - an [MCP server](https://modelcontextprotocol.io) so Claude, Cursor, and any
    MCP client can create inboxes and read verification codes as native tools
  - an `llms.txt` at the repository root for LLM-friendly onboarding

|                        | TossInbox               | temp-mail websites  | tmpmail-era CLIs            |
|------------------------|-------------------------|---------------------|-----------------------------|
| JSON on every command  | `--json`                | no                  | rarely                      |
| Documented exit codes  | 0–4                     | none                | no                          |
| MCP server for agents  | yes, built in           | no                  | no                          |
| Runs headless / in CI  | yes                     | no                  | partial                     |
| Upstream alive         | 7 providers, 4 stacks  | varies              | many wrap the dead 1secmail |
| Ads, trackers, popups  | none                    | the business model  | none                        |

Checked September 2026. If a cell is wrong, open an issue and win the argument.

## Install

Requires Node.js 18+.

```bash
# Homebrew (macOS, Linux)
brew install mohamed-khairy-5i/tap/tossinbox

# npm (npmjs.com)
npm install -g tossinbox

# Or run without installing
npx tossinbox@latest spawn
```

From source:

```bash
git clone https://github.com/mohamed-khairy-5i/tossinbox.git
cd tossinbox
npm install
npm run build
node dist/cli.js --help
```

## Quickstart

Four commands from zero to a tossed inbox:

```bash
tossinbox providers             # sanity check: install + network work
tossinbox spawn                 # create an inbox (saved locally)
tossinbox wait --code           # block until a message arrives, print its OTP
tossinbox toss                  # delete the inbox server-side + wipe local state
```

Every command also accepts `--json` for machine-readable output:

```bash
tossinbox spawn --json
tossinbox wait --code --json
```

## CLI Reference

| Command | Description |
|---|---|
| `spawn` | Create a new disposable inbox (`-p provider`, `-l label`). If the provider is down, another one is used automatically — `--no-failover` opts out |
| `list` | List messages (`-a address`) |
| `read <id>` | Read a full message, including any detected code |
| `wait` | Poll until a message arrives (`-f sender`, `-s subject`, `-c` extract code, `-t timeout` max 600s) |
| `watch` | Stream new messages until Ctrl-C — only new arrivals; `--json` = one JSON object per line (NDJSON) |
| `inboxes` | List locally saved inboxes |
| `toss` | Delete an inbox server-side and remove it from local state (`--all` for every inbox) |
| `clear` | Remove all inboxes from local state only |
| `providers` | List available email providers |
| `mcp` | Run the MCP server over stdio |

### Exit codes

A stable contract: agents script against these, not against stdout.

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Error (provider / network / unexpected) |
| `2` | Timeout (`wait` expired without a matching message) |
| `3` | Not found (no saved inbox, unknown address, or message missing) |
| `4` | Usage error (bad flags, unknown command, or unknown provider) |

## GitHub Action (email verification in CI)

Use TossInbox directly in your workflows to test real signup / verification
email flows:

```yaml
- uses: mohamed-khairy-5i/tossinbox@v1
  id: mail
  with:
    args: "wait --code --json"
    timeout: "180"

- run: echo "Verification code: ${{ steps.mail.outputs.code }}"
```

Outputs: `address` (the disposable inbox) and `code` (the extracted OTP).

## MCP Server (for AI agents)

TossInbox ships with an MCP server exposing four tools:

| Tool | Description |
|---|---|
| `create_inbox` | Create a disposable inbox and return its address |
| `list_messages` | List messages in an inbox |
| `read_message` | Read a full message, including any detected code |
| `wait_for_code` | Poll until a message arrives and return its verification code |

### Claude Desktop / Cursor / any MCP client

```json
{
  "mcpServers": {
    "tossinbox": {
      "command": "npx",
      "args": ["-y", "tossinbox", "mcp"]
    }
  }
}
```

Or after a global install, simply use `tossinbox-mcp` as the command —
equivalent to `npx -y tossinbox mcp`.

### Works with any AI agent

TossInbox is deliberately agent-agnostic — no lock-in to one vendor:

- **Any MCP client**: Claude Desktop, Claude Code, Cursor, Windsurf, Cline,
  Codex CLI, Gemini CLI, and every other MCP-compatible client
- **Any shell-capable agent**: the CLI itself is the interface — `--json` on
  every command, exit codes `0–4` documented, zero interactive prompts
- **CI/CD**: the GitHub Action above needs no agent at all

## Using TossInbox with an agent (copy-paste flow)

```text
1. "Create a disposable inbox"            -> tool: create_inbox
2. "Sign up at example.com with this address"
3. "Wait for the verification code from example.com"
                                           -> tool: wait_for_code
4. "Use code 482913 to finish the signup"
5. "Toss the inbox when done"              -> CLI: tossinbox toss
```

## Agent discovery surfaces

If you are an AI agent or LLM reading this: everything below is
machine-readable and kept up to date.

- [llms.txt](./llms.txt) at the repository root — full onboarding in one file
- [llms.txt on the website](https://tossinbox.pages.dev/llms.txt)
- [MCP Server Card](https://tossinbox.pages.dev/.well-known/mcp/server-card.json)
- [Agent skill (SKILL.md)](https://tossinbox.pages.dev/.well-known/agent-skills/tossinbox/SKILL.md)
  · [skills index](https://tossinbox.pages.dev/.well-known/agent-skills/index.json)
- [API catalog (RFC 9727)](https://tossinbox.pages.dev/.well-known/api-catalog)
- [ARD manifest](https://tossinbox.pages.dev/.well-known/ard.json)
- Markdown mirrors of every docs page: send `Accept: text/markdown` to
  [tossinbox.pages.dev](https://tossinbox.pages.dev/) or fetch `/index.md`,
  `/quickstart.md`, `/cli.md`, `/agents.md`, `/faq.md`

## Providers

| Provider | API key | Notes |
|---|---|---|
| `mailtm` (default) | not required | mail.tm — reliable, fast |
| `mailgw` | not required | mail.gw — mail.tm-compatible API on independent infrastructure |
| `guerrillamail` | not required | GuerrillaMail — classic fallback |
| `tempmaillol` | not required | tempmail.lol — random inbox on rotating domains |
| `tempmailio` | not required | temp-mail.io — server-generated address, `toss` deletes server-side |
| `tempmailplus` | not required | tempmail.plus — pick-your-name inbox on 9 public domains |
| `maildrop` | not required | maildrop.cc — public inbox on one stable domain |

Adding a provider means implementing a small interface (`createInbox`,
`listMessages`, `readMessage`, optional `destroyInbox`) — PRs welcome.

## FAQ

**Is it really free?**
Yes. MIT-licensed, and all seven upstream providers are free with no API keys.

**Can it send email?**
No — receive-only by design. TossInbox exists for privacy and testing and
ships no bulk-send or bulk-signup mode.

**Does it work on Windows?**
Yes, anywhere Node.js 18+ runs. `npx tossinbox@latest spawn`
works in PowerShell exactly the same.

**What if a provider is down?**
`spawn` fails over automatically: it retries the create against the remaining
providers and reports the switch (human mode prints a `⚠` warning and
`provider : mailtm (failover from mailgw)`; `--json` returns a `failover`
object). Use `--no-failover` if you need the chosen provider or nothing.

**A site blocked my disposable address. What now?**
Some sites blocklist known disposable domains. Try the other provider:
`tossinbox spawn -p guerrillamail`. If both are blocked, the site wins that
round.

## Privacy and safety

- The local state file (`~/.tossinbox/state.json`, override with
  `TOSSINBOX_STATE`) contains provider tokens and is written with `0600`
  permissions.
- `toss` deletes the account on the provider when supported, then wipes local
  state.
- Disposable email is for privacy and testing — not for abuse. Please respect
  each provider's terms of service.

## Roadmap

- [x] GitHub Action: `mohamed-khairy-5i/tossinbox@v1`
- [x] Homebrew tap: `brew install mohamed-khairy-5i/tap/tossinbox`
- [x] Project website at [tossinbox.pages.dev](https://tossinbox.pages.dev/)
- [x] Publish `tossinbox` + `tossinbox-mcp` to the [npm registry](https://www.npmjs.com/package/tossinbox)
- [x] `mail.gw` provider (v0.1.3)
- [x] Four more providers: `tempmail.lol`, `temp-mail.io`, `tempmail.plus`, `maildrop.cc` (v0.1.4)
- [x] Provider failover: auto-switch when a provider is down (v0.1.5)
- [ ] Homebrew core formula (after community adoption)

## Documentation

- [Quickstart](https://tossinbox.pages.dev/quickstart) — first inbox in four commands
- [CLI reference](https://tossinbox.pages.dev/cli) — every command, flag, and exit code
- [Agents & MCP](https://tossinbox.pages.dev/agents) — setup for every MCP client
- [FAQ](https://tossinbox.pages.dev/faq) — privacy, providers, troubleshooting
- [Examples](https://tossinbox.pages.dev/examples) — copy-paste recipes: shell, CI, Node.js, MCP
- [Guide](https://tossinbox.pages.dev/guide) — providers, state, flags, exit codes, troubleshooting
- [Roadmap](https://tossinbox.pages.dev/roadmap) — what shipped and what is next
- [Changelog](./CHANGELOG.md) · [Contributing](./CONTRIBUTING.md) · [Security](./SECURITY.md)

## License

[MIT](./LICENSE) © Mohamed Khairy
