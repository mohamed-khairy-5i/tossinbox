# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | yes |

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's **"Report a vulnerability"** button on the Security tab
(private security advisory), or contact the maintainer through GitHub
(@mohamed-khairy-5i). You will get a response within a few days.

## Scope and design notes

- The local state file (`~/.tossinbox/state.json`, override with
  `TOSSINBOX_STATE`) stores provider tokens/passwords and is written with
  `0600` permissions (directory `0700`). Treat it as a secret.
- All provider traffic goes over HTTPS with a 20-second timeout per request.
- Inboxes are disposable and shared: **never** use them for sensitive
  accounts. Anything sent to a disposable address must be considered public.
- TossInbox intentionally ships no bulk-send or bulk-signup mode.
