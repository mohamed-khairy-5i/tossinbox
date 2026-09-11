# TossInbox

<p align="center">
  <img src="docs/logo.png" width="140" alt="TossInbox logo">
</p>

**Disposable email inboxes for humans and AI agents. Spawn an inbox, wait for the OTP, toss it.**

<p align="center">
  <a href="https://mohamed-khairy-5i.github.io/tossinbox/">Website</a> ·
  <a href="https://github.com/mohamed-khairy-5i/tossinbox#readme">Docs</a> ·
  <a href="https://github.com/mohamed-khairy-5i/tossinbox/issues">Issues</a>
</p>

[![CI](https://github.com/mohamed-khairy-5i/tossinbox/actions/workflows/ci.yml/badge.svg)](https://github.com/mohamed-khairy-5i/tossinbox/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

> **Built by [Mohamed Khairy](https://github.com/mohamed-khairy-5i).**
> If TossInbox saved you a signup form, consider starring the repo — it helps more people find it.

TossInbox gives you a brand-new disposable email address in one command. Use it to
sign up anywhere, then let `wait` collect the verification code for you — or let
your **AI agent** do it through the built-in **MCP server**. When you are done,
toss the inbox: it is deleted server-side and wiped from local state.

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

## Why

- **For humans** — no more exposing your real address to every signup form.
- **For agents** — TossInbox is built agent-first from day one:
  - `--json` output on every command
  - documented exit codes, no interactive prompts
  - an [MCP server](https://modelcontextprotocol.io) so Claude, Cursor, and any
    MCP client can create inboxes and read verification codes as tools
  - an `llms.txt` at the repository root for LLM-friendly onboarding

## Install

Requires Node.js 18+.

```bash
# Homebrew
brew install mohamed-khairy-5i/tap/tossinbox

# npm from GitHub (npm registry publish coming soon)
npm install -g github:mohamed-khairy-5i/tossinbox

# Or run without installing
npx github:mohamed-khairy-5i/tossinbox spawn
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

```bash
tossinbox spawn                 # create an inbox (saved locally)
tossinbox list                  # see what arrived
tossinbox read <message-id>     # read a full message
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
| `spawn` | Create a new disposable inbox (`-p provider`, `-l label`) |
| `list` | List messages (`-a address`) |
| `read <id>` | Read a full message, including any detected code |
| `wait` | Poll until a message arrives (`-f sender`, `-s subject`, `-c` extract code, `-t timeout`) |
| `inboxes` | List locally saved inboxes |
| `toss` | Delete an inbox server-side and remove it from local state (`--all` for every inbox) |
| `clear` | Remove all inboxes from local state only |
| `providers` | List available email providers |
| `mcp` | Run the MCP server over stdio |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Error (provider / network / unexpected) |
| `2` | Timeout (`wait` expired without a matching message) |
| `3` | Not found (no saved inbox, unknown address, or message missing) |
| `4` | Usage error (bad flags, unknown command, or unknown provider) |

## GitHub Action (email verification in CI)

Use TossInbox directly in your workflows:

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
      "args": ["-y", "github:mohamed-khairy-5i/tossinbox", "mcp"]
    }
  }
}
```

Or after a global install, simply use `tossinbox-mcp` as the command.

### Works with any AI agent

TossInbox is deliberately agent-agnostic — no lock-in to one vendor:

- **Any MCP client**: Claude Desktop, Claude Code, Cursor, Windsurf, Cline,
  Codex CLI, and every other MCP-compatible client
- **Any shell-capable agent**: the CLI itself is the interface — `--json` on
  every command, exit codes `0–4` documented, zero interactive prompts
- **CI/CD**: the GitHub Action below needs no agent at all

## Using TossInbox with an agent (copy-paste flow)

```text
1. "Create a disposable inbox"            -> tool: create_inbox
2. "Sign up at example.com with this address"
3. "Wait for the verification code from example.com"
                                           -> tool: wait_for_code
4. "Use code 482913 to finish the signup"
5. "Toss the inbox when done"              -> CLI: tossinbox toss
```

## Providers

| Provider | API key | Notes |
|---|---|---|
| `mailtm` (default) | not required | mail.tm — reliable, fast |
| `guerrillamail` | not required | GuerrillaMail — classic fallback |

Adding a provider means implementing a small interface (`createInbox`,
`listMessages`, `readMessage`, optional `destroyInbox`) — PRs welcome.

## Privacy and safety

- The local state file (`~/.tossinbox/state.json`, override with
  `TOSSINBOX_STATE`) contains provider tokens and is written with `0600`
  permissions.
- `toss` deletes the account on the provider when supported, then wipes local
  state.
- TossInbox intentionally ships **no bulk-send or bulk-signup mode**. Disposable
  email is for privacy and testing — not for abuse. Please respect each
  provider's terms of service.

## Roadmap

- [x] GitHub Action: `mohamed-khairy-5i/tossinbox@v1`
- [x] Homebrew tap: `brew install mohamed-khairy-5i/tap/tossinbox`
- [x] Project website on GitHub Pages
- [ ] Publish `tossinbox` + `tossinbox-mcp` to the npm registry
- [ ] `mail.gw` provider (mail.tm-compatible API — small lift)
- [ ] `tempmail.lol` provider (free API)
- [ ] Provider failover: auto-switch when a provider is down
- [ ] Homebrew core formula (after community adoption)

## License

[MIT](./LICENSE) © Mohamed Khairy

Contributing: see [CONTRIBUTING.md](./CONTRIBUTING.md) ·
Security: see [SECURITY.md](./SECURITY.md) ·
Changes: see [CHANGELOG.md](./CHANGELOG.md)
