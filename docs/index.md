# TossInbox: disposable email CLI and MCP server for AI agents

Spawn an inbox. Get the code. Toss it. Built agent-first: `--json` on every
command, exit codes documented 0–4, zero interactive prompts.

- Version: v0.1.2 · License: MIT · Node 18+ · macOS, Linux, Windows
- Repository: https://github.com/mohamed-khairy-5i/tossinbox
- Markdown version of https://tossinbox.pages.dev/

## What is TossInbox?

TossInbox is a disposable email CLI and MCP server. One command spawns a
throwaway inbox on a real mail provider; a second waits for the verification
code and prints it; a third deletes the inbox. Humans read the output, agents
parse the `--json`. No sign-up, no ads, no browser.

## Install

Requires Node.js 18+. No accounts, no API keys, no config files. Four ways in,
pick one:

```bash
# Homebrew (macOS, Linux)
brew install mohamed-khairy-5i/tap/tossinbox

# npm (from GitHub)
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

## Why TossInbox

Disposable email already exists as ad-covered websites and as human-first CLI
wrappers around a dead upstream API. TossInbox is the one built for programs.

- `tossinbox spawn` gives you a real inbox on a live provider. No sign-up, no
  browser, no ads.
- `tossinbox wait --code` blocks until the verification email lands, prints
  the code, exits clean. Script it.
- `tossinbox toss` deletes the inbox. Gone from the server, gone from disk.

| Feature                   | TossInbox          | temp-mail websites  | tmpmail-era CLIs            |
|---------------------------|--------------------|---------------------|-----------------------------|
| JSON on every command     | `--json`           | no                  | rarely                      |
| Documented exit codes     | 0–4                | none                | no                          |
| MCP server for agents     | yes, built in      | no                  | no                          |
| Runs headless / in CI     | yes                | no                  | partial                     |
| Upstream providers alive  | mail.tm + GuerrillaMail | varies         | many wrap the dead 1secmail |
| Ads, trackers, popups     | none               | the business model  | none                        |

Checked September 2026. If a cell is wrong, open an issue and win the argument.

## Changelog

- **v0.1.1** — 2026-09-11: fixed a silent MCP bin-symlink failure, implemented
  exit code 4, added hard request timeouts, made a corrupted state file fail
  loudly instead of being overwritten, OTP codes lowercased.
- **v0.1.0** — 2026-09-10: first public release, CLI + MCP server, GitHub
  Action, Homebrew tap.

Full diffs in the GitHub releases.

## Docs directory

```console
$ ls docs/
quickstart/   spawn your first inbox in 60 seconds
cli/          every command, flag, and exit code
agents/       MCP setup for Claude, Cursor, Codex and friends
examples/     copy-paste recipes: signup tests, OTP capture, CI
guide/        the full manual: providers, options, gotchas
changelog/    what actually shipped, per version
roadmap/      what is planned, and what is deliberately not
faq/          short answers to real questions
ar/           النسخة العربية من الموقع
llms.txt      the whole site as one plain-text file, for machines
```

## Where next

- Quickstart: https://tossinbox.pages.dev/quickstart.html
- CLI reference: https://tossinbox.pages.dev/cli.html
- Agents & MCP: https://tossinbox.pages.dev/agents.html
- Examples: https://tossinbox.pages.dev/examples.html
- Guide: https://tossinbox.pages.dev/guide.html
- Changelog: https://tossinbox.pages.dev/changelog.html
- Roadmap: https://tossinbox.pages.dev/roadmap.html
- FAQ: https://tossinbox.pages.dev/faq.html
- Arabic: https://tossinbox.pages.dev/ar/
- llms.txt: https://tossinbox.pages.dev/llms.txt

MIT License © 2026 Mohamed Khairy
