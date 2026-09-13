# Guide

Everything the four-command quickstart left out: how providers and state work,
every flag that matters, what each exit code means, and what to do when
something misbehaves. Flag-by-flag syntax lives on the CLI reference:
https://tossinbox.pages.dev/cli.html

Markdown version of https://tossinbox.pages.dev/guide.html

## Concepts you need first

Three facts explain almost all of TossInbox's behavior.

- **Providers are free public mail APIs.** `mailtm` is the default;
  `guerrillamail` is the fallback. No accounts, no API keys — the CLI creates
  the mailbox itself and keeps its credentials in local state. Run
  `tossinbox providers` to see them.
- **State is one local file:** `~/.tossinbox/state.json`, written with `0600`
  and saved atomically (v0.1.2+) — a crash mid-write can no longer truncate it.
  It holds the addresses + tokens of your live inboxes. Override its location
  with `TOSSINBOX_STATE` — useful for CI parallelism and tests.
- **TossInbox receives; it never sends.** It exists to collect
  signup/verification mail. There is no send path, which is exactly why
  providers tolerate it.

## Creating inboxes

`spawn` creates the mailbox, saves it to state, and prints the address. Plain
text for humans, `--json` for programs. If the provider you asked for is down
(network error, 5xx, 429), `spawn` fails over: it retries the create against
the remaining providers and reports the switch (`provider : mailtm (failover
from mailgw)`, or a `failover` object in JSON).

```bash
tossinbox spawn                       # default provider, plain output
tossinbox spawn --json                # machine-readable (ok, inbox{address,…})
tossinbox spawn -p guerrillamail      # pick a provider explicitly
tossinbox spawn -p mailgw --no-failover  # strict: mailgw or nothing
tossinbox spawn -l github-test        # label it — labels show in `inboxes`
tossinbox inboxes                     # every inbox saved in local state
```

Inboxes on the provider expire on their own schedule; the local record is what
TossInbox cleans when you `toss`. Neither expires just because your terminal
closed.

## Receiving mail and codes

Three commands: `list` peeks at what arrived, `read` opens one message, and
`wait` blocks until the message you care about lands — then prints its
extracted code.

| flag | meaning | default |
|------|---------|---------|
| `--code` | require an extractable verification code; keep polling until one arrives | off (first message wins) |
| `--from, -f` | only messages from this sender | any |
| `--subject, -s` | only messages whose subject matches | any |
| `--timeout, -t` | give up after N seconds (exit code `2`) | 60 |
| `--interval, -i` | seconds between polls | 3 |

```bash
tossinbox list                              # messages in the newest inbox
tossinbox list -a qwd6996p1lbc@uberip.com   # messages for a specific address
tossinbox read 42                           # full body + headers of message 42
tossinbox read 42 --save                    # attachments + bodies → ./tossinbox-attachments/42/
tossinbox read 42 --html                    # raw HTML body instead of the plain text
tossinbox wait --code --from noreply@example-app.dev --timeout 120
```

Messages can carry attachments: `read` prints an `attachments` block (name,
size, type), and `read --save [dir]` downloads every attachment plus the
HTML/plain-text bodies into `<dir>/<message-id>/` (default dir:
`./tossinbox-attachments`). With `--json` a `saved` array lists the exact file
paths. `--html` prints the raw HTML body and warns when the message has none.
Attachment downloads are full on `mailtm`, `mailgw` and `tempmailplus`, partial
on `tempmailio` (only when its upstream exposes a URL), and absent on
`tempmaillol`, `guerrillamail` and `maildrop` — their upstreams never expose
attachments.

Code extraction handles digits-only and letter+digit OTPs (letters come back
uppercased) and understands prompts in twelve languages — English and Arabic
(رمز / كود / تفعيل / تحقق), plus French, Spanish, German, Portuguese, Italian,
Russian, Turkish, Chinese, Japanese, and Korean.

## Cleanup: toss vs clear

Two cleanup verbs with one important difference.

- `tossinbox toss` deletes the inbox **on the provider** (where supported) **and**
  wipes its local record. `toss --all` does every saved inbox.
- `tossinbox clear` wipes **local records only** — no server-side deletion. Use
  it when the mailbox already expired upstream and you just want clean state.

```bash
tossinbox toss          # delete current inbox on server + locally
tossinbox toss --all    # same, for every saved inbox
tossinbox clear         # local records only, server untouched
```

## Exit codes (the whole contract)

Scripts should never parse human text when an exit code will do.

| code | meaning | typical cause |
|------|---------|---------------|
| `0` | success | — |
| `1` | error | provider API failure, network error |
| `2` | timeout | no matching message before `--timeout` |
| `3` | not found | unknown address, no saved inbox, nothing to toss |
| `4` | usage error | bad flags, unknown provider, garbage values |

With `--json`, failures additionally print `{"ok":false,"error":"…"}` on stdout
before exiting non-zero.

## Troubleshooting

The failures that actually happen, in the order you'll meet them.

### wait exits with code 2 — the email never came

Check the sender/subject filters aren't too strict, raise `--timeout` (bulk
senders can take minutes), and confirm the signup email was actually sent. If
the provider is degraded, spawn a fresh inbox with `-p guerrillamail` and retry.

### spawn fails with exit code 1

If the requested provider was down, failover already tried every other
provider before failing — the error is the requested provider's original
message plus a `failover also tried N other provider(s)` note, which means
everything upstream is having a bad day. Wait a bit and retry, or check
`tossinbox providers`. Add `--no-failover` when you need to see the chosen
provider's raw failure without the fallback tour. All HTTP calls carry a hard
20-second timeout, so this always fails fast instead of hanging.

### "corrupt state file" error on any command

v0.1.1 refuses to silently overwrite a damaged `~/.tossinbox/state.json` — fix
it by deleting the file (losing saved inbox records, not your machine) or point
`TOSSINBOX_STATE` at a fresh path.

### `read --save` says the provider does not support attachment downloads

The message has attachments, but that provider's upstream never exposes them.
Full download support: `mailtm`, `mailgw`, `tempmailplus`; `tempmailio` only
when upstream exposes a URL; `tempmaillol`, `guerrillamail` and `maildrop`
have none. Re-read the message on a supported provider. Saving the bodies
alone (`body.html` / `body.txt`) works on every provider — the error fires
only when the message actually carries attachments.

### Parallel test runs stomp on each other

Give each run its own state file: `TOSSINBOX_STATE=$(mktemp) tossinbox spawn`.
Nothing else is shared.

### Is this legal / will my real inbox be affected?

Disposable email for testing and privacy is a normal use case — just respect
each provider's terms of service, and remember TossInbox can never touch your
real mailbox: it creates separate throwaway accounts.

MIT License © 2026 Mohamed Khairy
