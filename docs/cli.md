# CLI reference

Nine commands. The table is the manual. Every command also accepts `--json`
and exits 0–4 — that contract is documented below, not discovered at runtime.

Markdown version of https://tossinbox.pages.dev/cli.html

## Commands

| Command     | What it does                                                                                            |
|-------------|---------------------------------------------------------------------------------------------------------|
| `spawn`     | Create a new disposable inbox. Flags: `-p provider`, `-l label`                                          |
| `list`      | List messages in an inbox. Flags: `-a address` (defaults to most recent)                                 |
| `read <id>` | Read a full message, including any detected verification code. Flags: `-a address`                       |
| `wait`      | Poll until a message arrives. Flags: `-a address`, `-f from`, `-s subject`, `-c` extract code, `-t` timeout (max 600s), `-i` interval |
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
| `guerrillamail` | GuerrillaMail, classic fallback |

New provider = one small file implementing `createInbox` / `listMessages` /
`readMessage` / `destroyInbox` (optional).

MIT License © 2026 Mohamed Khairy
