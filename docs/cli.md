# CLI reference

Ten commands. The table is the manual. Every command also accepts `--json`
and exits 0–4 — that contract is documented below, not discovered at runtime.

Markdown version of https://tossinbox.pages.dev/cli.html

## Commands

| Command     | What it does                                                                                            |
|-------------|---------------------------------------------------------------------------------------------------------|
| `spawn`     | Create a new disposable inbox. If the provider is down, another one is used automatically (`--no-failover` opts out). Flags: `-p provider`, `-l label` |
| `list`      | List messages in an inbox. Flags: `-a address` (defaults to most recent)                                 |
| `read <id>` | Read a full message, including any detected verification code. Lists attachments (name, size, type). Flags: `-a address`, `--html` raw HTML body, `--save [dir]` save attachments + bodies to `<dir>/<message-id>/` |
| `wait`      | Poll until a message arrives. Flags: `-a address`, `-f from`, `-s subject`, `-c` extract code, `-t` timeout (max 600s), `-i` interval |
| `watch`     | Stream new messages as they arrive until Ctrl-C — only new arrivals, never history. Flags: `-a address`, `-f from`, `-s subject`, `-i` interval (1–60s). With `--json`: one compact JSON object per line (NDJSON) |
| `inboxes`   | List locally saved inboxes                                                                               |
| `toss`      | Delete an inbox server-side + wipe local state. Flags: `-a address`, `--all`                             |
| `clear`     | Remove all inboxes from local state only (server accounts stay)                                          |
| `providers` | List available email providers                                                                           |
| `mcp`       | Run the MCP server over stdio. This is what agents connect to                                            |

## Exit codes

| Exit code | Meaning                                                |
|-----------|--------------------------------------------------------|
| 0         | Success                                                |
| 1         | Error: network, provider, unexpected failure           |
| 2         | Timeout: `wait` expired with no matching message       |
| 3         | Not found: no saved inbox, unknown address, missing message |
| 4         | Usage error: bad flags, unknown command or provider    |

A stable contract: agents script against these, not against stdout.

## Providers

| Provider        | Notes                          |
|-----------------|--------------------------------|
| `mailtm`        | mail.tm, the default, no API key |
| `mailgw`        | mail.gw — mail.tm-compatible API on independent infrastructure |
| `guerrillamail` | GuerrillaMail, classic fallback |
| `tempmaillol`   | tempmail.lol — random inbox on rotating domains |
| `tempmailio`    | temp-mail.io — server-generated address, `toss` deletes server-side |
| `tempmailplus`  | tempmail.plus — pick-your-name inbox on 9 public domains |
| `maildrop`      | maildrop.cc — public inbox on one stable domain |

New provider = one small file implementing `createInbox` / `listMessages` /
`readMessage` / `destroyInbox` (optional).

## Attachments and HTML bodies (v0.1.6)

`read` shows a message's attachments (name, size, type) as an `attachments`
block in human output; `--json` includes the same metadata as
`message.attachments` (`filename`, `size`, `contentType`).

| Flag           | What it does                                                                                   |
|----------------|------------------------------------------------------------------------------------------------|
| `--save [dir]` | Download every attachment and write the HTML/plain-text bodies into `<dir>/<message-id>/` (default dir: `./tossinbox-attachments`). With `--json`, a `saved` array carries the exact file paths |
| `--html`       | Print the raw HTML body instead of the plain-text version; warns when the message has none      |

```bash
tossinbox read 42 --save                # ./tossinbox-attachments/42/{body.html, body.txt, report.pdf, …}
tossinbox read 42 --save /tmp           # same, into /tmp/42/
tossinbox read 42 --html                # raw HTML body
```

Attachment coverage by provider: `mailtm`, `mailgw` and `tempmailplus` list and
download attachments; `tempmailio` shows them when the upstream response
includes them (downloadable only if it exposes a URL); `tempmaillol`,
`guerrillamail` and `maildrop` do not expose attachments upstream — TossInbox
tells you that instead of guessing.

## Provider failover

`spawn` does not give up just because an upstream is having a bad day. When the
requested provider answers with a network error, a 5xx, or a 429, TossInbox
retries the same create against the remaining providers (requested provider
first, then registration order) and tells you exactly what happened:

- human output: one `⚠` warning per failed attempt, then `provider : mailtm (failover from mailgw)`
- `--json`: a `failover` object (`requested` / `used`) plus a `warnings` array
- `--no-failover`: strict mode — fail instead of switching
- a plain 4xx on the requested provider is a real request problem, so it fails without fallback

MIT License © 2026 Mohamed Khairy
