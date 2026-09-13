# Changelog

Every notable TossInbox change, newest first. Generated from the repo's
CHANGELOG.md (edit that file, not this page). Full diffs:
https://github.com/mohamed-khairy-5i/tossinbox/releases

## 0.1.3 - 2026-09-13

### Added

- **`mail.gw` provider** (`spawn -p mailgw`) — mail.tm-compatible API on
- **`tossinbox watch`** — live-polling mode that prints each new message (and
- **Verification-code keywords now understand twelve languages.** French,

## 0.1.2 - 2026-09-13

### Added

- Website v2: brew/npx install tabs in the hero, a "Star on GitHub" secondary

### Fixed

- **Network failures now say what actually happened.** A dead connection used

### Changed

- **State saves are atomic.** `state.json` is written to a sibling temp file,

## 0.1.1 - 2026-09-11

### Fixed

- **`tossinbox-mcp` now starts when launched through npm/Homebrew bin symlinks.**
- Unknown providers and bad flags now exit with **code 4** (usage error),
- Every provider HTTP call now has a hard **20s timeout**, so agents can never
- A corrupt or unreadable state file is now reported **loudly** instead of
- Verification codes with **lowercase letters** (e.g. `f4x9k2`) are now

### Changed

- Inbox credentials are generated with `node:crypto` (cryptographic randomness)
- MCP tool failures set `isError: true` so clients render them as real errors.
- `read` errors during `wait` are retried once before giving up.
- `--timeout` / `--interval` values are validated up front (exit 4 on garbage).

## 0.1.0 - 2026-09-10

### Added

- First public release.
- CLI: `spawn`, `list`, `read`, `wait`, `inboxes`, `toss`, `clear`,
- MCP server over stdio with four tools: `create_inbox`, `list_messages`,
- Providers: **mail.tm** (default) and **GuerrillaMail** — no API keys.
- OTP extraction tuned for English and Arabic emails (رمز / كود / تفعيل / تحقق).
- State file `~/.tossinbox/state.json` written with `0600` permissions.
- GitHub Action (`mohamed-khairy-5i/tossinbox@v1`), Homebrew tap, project

MIT License © 2026 Mohamed Khairy
