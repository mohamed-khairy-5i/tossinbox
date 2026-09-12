# Quickstart

Four commands from zero to a tossed inbox. Not installed yet? There are four
ways in — Homebrew, npm, npx, or from source:
https://tossinbox.pages.dev/#install

Markdown version of https://tossinbox.pages.dev/quickstart.html

## The whole flow

Paste-runnable top to bottom, comments included. Everything else is optional
flags.

```bash
# 0: sanity check — prints providers, proves install + network work
tossinbox providers

# 1: create a fresh disposable address (saved locally)
tossinbox spawn

# 2: submit the address in the signup form FIRST; once the site has
#    sent its email, block until the code lands and print it
tossinbox wait --code --from noreply@example.com --timeout 120

# 3: delete it server-side and wipe the local record
tossinbox toss
```

Step 2 assumes you already submitted the address in a signup form.
TossInbox receives; it never sends.

## Machine-readable output

Every command accepts `--json`: same data, no ANSI colors. That is the whole
contract agents rely on.

```console
$ tossinbox spawn --json
{
  "ok": true,
  "inbox": {
    "address": "qwd6996p1lbc@uberip.com",
    "provider": "mailtm",
    "token": "…",
    "password": "…",
    "createdAt": "…"
  }
}
# token + password are yours alone, they live in ~/.tossinbox/state.json (0600)
```

Full flag list on the CLI reference page: https://tossinbox.pages.dev/cli.html

MIT License © 2026 Mohamed Khairy
