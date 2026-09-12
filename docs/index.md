# TossInbox: disposable email CLI and MCP server for AI agents

Spawn an inbox. Get the code. Toss it. Built agent-first: `--json` on every
command, exit codes documented 0–4, zero interactive prompts.

- Version: v0.1.1 · License: MIT · Node 18+ · macOS, Linux, Windows
- Repository: https://github.com/mohamed-khairy-5i/tossinbox
- Markdown version of https://tossinbox.pages.dev/

## Why TossInbox

TossInbox is a disposable email CLI and MCP server: one command spawns a
throwaway inbox on a real mail provider, a second waits for the verification
code and prints it, a third deletes the inbox. Humans read the output, agents
parse the `--json`. No sign-up, no ads, no browser — and no ad-covered
websites.

- `tossinbox spawn` gives you a real inbox on a live provider. No sign-up, no
  browser, no ads.
- `tossinbox wait --code` blocks until the verification email lands, prints
  the code, exits clean. Script it.
- `tossinbox toss` deletes the inbox on the provider and wipes the local
  record. Gone from the server, gone from disk.
- It receives, never sends — which is exactly why the providers tolerate it.

## Install

Requires Node.js 18+. No accounts, no API keys, no config files. Four ways in,
pick one:

```bash
# Homebrew (macOS, Linux)
brew install mohamed-khairy-5i/tap/tossinbox

# npm
npm install -g tossinbox

# npx (nothing installed)
npx tossinbox@latest spawn

# from source
git clone https://github.com/mohamed-khairy-5i/tossinbox.git && cd tossinbox && npm install && npm run build
```

Example session:

```console
$ tossinbox spawn
✔ Inbox ready: qwd6996p1lbc@uberip.com (provider: mailtm)

$ tossinbox wait --code --from noreply@example.com
✔ code received from: ExampleApp <noreply@example.com>
  code: 9378412

$ tossinbox toss
✔ tossed qwd6996p1lbc@uberip.com — gone from the server, gone from disk.
```

## Latest release

- **v0.1.1** — 2026-09-11: fixed a silent MCP bin-symlink failure, implemented
  exit code 4, added hard request timeouts, made a corrupted state file fail
  loudly instead of being overwritten.

Full changelog: https://tossinbox.pages.dev/changelog.html
Full diffs in the GitHub releases.

## The manual, classified

Eight short pages, each with a Markdown twin for agents:

- Quickstart — four commands, first code in about ninety seconds:
  https://tossinbox.pages.dev/quickstart.html
- CLI reference — every command, flag, and default:
  https://tossinbox.pages.dev/cli.html
- Agents & MCP — MCP config, tool schemas, agent-friendly guarantees:
  https://tossinbox.pages.dev/agents.html
- Examples — copy-paste recipes (OTP capture, CI signups, Playwright):
  https://tossinbox.pages.dev/examples.html
- Guide — providers, state, wait filters, exit codes, troubleshooting:
  https://tossinbox.pages.dev/guide.html
- Roadmap — shipped, next, under consideration:
  https://tossinbox.pages.dev/roadmap.html
- FAQ — direct answers: https://tossinbox.pages.dev/faq.html
- Arabic landing (RTL): https://tossinbox.pages.dev/ar/
- llms.txt: https://tossinbox.pages.dev/llms.txt

MIT License © 2026 Mohamed Khairy
