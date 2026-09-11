# Changelog

All notable changes to TossInbox are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com); versioning follows [semver](https://semver.org).

## [Unreleased]

### Fixed
- **`tossinbox-mcp` now starts when launched through npm/Homebrew bin symlinks.**
  Previously the direct-run check compared unresolved paths, so the globally
  installed binary exited silently without starting the MCP server.
- Unknown providers and bad flags now exit with **code 4** (usage error),
  matching the documented contract.
- Every provider HTTP call now has a hard **20s timeout**, so agents can never
  hang forever on a stalled connection.
- A corrupt or unreadable state file is now reported **loudly** instead of
  being silently overwritten (which could destroy saved inboxes).
- Verification codes with **lowercase letters** (e.g. `f4x9k2`) are now
  extracted and returned uppercased.

### Changed
- Inbox credentials are generated with `node:crypto` (cryptographic randomness)
  instead of `Math.random()`.
- MCP tool failures set `isError: true` so clients render them as real errors.
- `read` errors during `wait` are retried once before giving up.
- `--timeout` / `--interval` values are validated up front (exit 4 on garbage).

## [0.1.0] - 2026-09-10

### Added
- First public release.
- CLI: `spawn`, `list`, `read`, `wait`, `inboxes`, `toss`, `clear`,
  `providers`, `mcp` — every command supports `--json`; documented exit codes.
- MCP server over stdio with four tools: `create_inbox`, `list_messages`,
  `read_message`, `wait_for_code`.
- Providers: **mail.tm** (default) and **GuerrillaMail** — no API keys.
- OTP extraction tuned for English and Arabic emails (رمز / كود / تفعيل / تحقق).
- State file `~/.tossinbox/state.json` written with `0600` permissions.
- GitHub Action (`mohamed-khairy-5i/tossinbox@v1`), Homebrew tap, project
  website on GitHub Pages, `llms.txt` for LLM onboarding.
