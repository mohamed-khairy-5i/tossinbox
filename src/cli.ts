#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import {
  DEFAULT_PROVIDER,
  createInboxWithFailover,
  getProvider,
  listProviders,
  listSavedInboxes,
  removeInbox,
  clearInboxes,
  resolveInbox,
  saveInbox,
  saveMessageContent,
  statePath,
  waitForMessage,
  sleep,
  htmlToText,
  ProviderError,
  type EmailProvider,
  type Inbox,
  type Message,
  type SavedFile,
} from "./core/index.js";
import { VERSION } from "./version.js";

/* Documented exit codes:
 * 0  success
 * 1  error (provider / network / unexpected)
 * 2  timeout (wait expired without a matching message)
 * 3  not found (no saved inbox, unknown address, or message missing)
 * 4  usage error (bad flags / unknown command / unknown provider)
 */
const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_TIMEOUT = 2;
const EXIT_NOT_FOUND = 3;
const EXIT_USAGE = 4;

const program = new Command();

program
  .name("tossinbox")
  .description("Disposable email inboxes for humans and AI agents. Spawn an inbox, wait for the OTP, toss it.")
  .version(VERSION)
  .option("--json", "machine-readable JSON output (agent-friendly)");

function jsonMode(): boolean {
  return Boolean(program.opts().json);
}

function out(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/** Resolve a provider by name; an unknown provider is a usage error (exit 4). */
function providerOrExit(name?: string): EmailProvider {
  try {
    return getProvider(name);
  } catch (err) {
    fail(err, EXIT_USAGE);
  }
}

function fail(err: unknown, exitCode = EXIT_ERROR): never {
  const message = err instanceof Error ? err.message : String(err);
  if (jsonMode()) {
    out({ ok: false, error: message });
  } else {
    console.error(`✖ ${message}`);
  }
  process.exit(exitCode);
}

function exitWith(code: number): never {
  process.exit(code);
}

function jsonMessage(message: Message, includeHtml = false): Record<string, unknown> {
  return {
    id: message.id,
    from: message.from,
    fromName: message.fromName,
    subject: message.subject,
    createdAt: message.createdAt,
    code: message.code,
    text: message.text ?? (message.html ? htmlToText(message.html) : undefined),
    html: includeHtml ? message.html : undefined,
    ...(message.attachments
      ? {
          attachments: message.attachments.map((a) => ({
            filename: a.filename,
            size: a.size,
            contentType: a.contentType,
          })),
        }
      : {}),
  };
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function printMessageHuman(message: Message, withBody: boolean): void {
  console.log(`✔ ${message.subject}`);
  console.log(`  from : ${message.fromName ? `${message.fromName} <${message.from}>` : message.from}`);
  if (message.createdAt) console.log(`  date : ${message.createdAt}`);
  if (message.code) console.log(`  code : ${message.code}`);
  if (message.attachments && message.attachments.length > 0) {
    console.log(`  attachments (${message.attachments.length}):`);
    for (const a of message.attachments) {
      console.log(`    - ${a.filename} (${formatSize(a.size)}${a.contentType ? `, ${a.contentType}` : ""})`);
    }
  }
  if (withBody) {
    const body = message.text ?? (message.html ? htmlToText(message.html) : "");
    if (body) console.log(`\n${body}\n`);
  }
}

/* ------------------------------------------------------------------ */
/* commands                                                            */
/* ------------------------------------------------------------------ */

program
  .command("spawn")
  .description("Create a new disposable inbox (automatically falls back to another provider when the chosen one is down)")
  .option("-p, --provider <name>", "email provider (see: providers)", DEFAULT_PROVIDER)
  .option("-l, --label <label>", "optional label to identify this inbox")
  .option("--no-failover", "fail if the chosen provider is down instead of falling back to another one")
  .action(async (opts) => {
    try {
      providerOrExit(opts.provider); // unknown name = usage error before any network call
      const { inbox, switched, warnings } = await createInboxWithFailover({
        requested: opts.provider,
        label: opts.label,
        failover: opts.failover,
      });
      await saveInbox(inbox);

      if (jsonMode()) {
        out({
          ok: true,
          inbox,
          ...(switched ? { failover: { requested: opts.provider, used: inbox.provider } } : {}),
          ...(warnings.length > 0 ? { warnings } : {}),
        });
        return;
      }
      for (const warning of warnings) console.error(`⚠ ${warning}`);
      console.log(`✔ Inbox ready : ${inbox.address}`);
      console.log(`  provider    : ${inbox.provider}${switched ? ` (failover from ${opts.provider})` : ""}`);
      if (inbox.label) console.log(`  label       : ${inbox.label}`);
      console.log(`  state file  : ${statePath()}`);
    } catch (err) {
      if (err instanceof ProviderError && err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        fail(err, EXIT_ERROR);
      }
      fail(err);
    }
  });

program
  .command("list")
  .description("List messages in an inbox")
  .option("-a, --address <address>", "inbox address (defaults to the most recent inbox)")
  .action(async (opts) => {
    try {
      const inbox = await resolveInbox(opts.address);
      if (!inbox) fail(new Error("No saved inbox found. Run: tossinbox spawn"), EXIT_NOT_FOUND);

      const provider = providerOrExit(inbox.provider);
      const messages = await provider.listMessages(inbox);

      if (jsonMode()) {
        out({ ok: true, inbox: inbox.address, provider: inbox.provider, count: messages.length, messages });
        return;
      }
      console.log(`✔ ${messages.length} message(s) in ${inbox.address}`);
      messages.forEach((m, i) => {
        console.log(`  ${i + 1}) [${m.id}] ${m.subject}`);
        console.log(`     from: ${m.fromName ? `${m.fromName} <${m.from}>` : m.from}`);
        if (m.intro) console.log(`     ${m.intro.slice(0, 100)}`);
      });
    } catch (err) {
      fail(err);
    }
  });

program
  .command("read <id>")
  .description("Read a full message by id (list attachments, optionally save them and the HTML body)")
  .option("-a, --address <address>", "inbox address (defaults to the most recent inbox)")
  .option("--html", "print the raw HTML body instead of the plain-text version")
  .option(
    "--save [dir]",
    "save attachments + body.html/body.txt into <dir>/<message-id>/ (default dir: ./tossinbox-attachments)"
  )
  .action(async (id: string, opts) => {
    try {
      const inbox = await resolveInbox(opts.address);
      if (!inbox) fail(new Error("No saved inbox found. Run: tossinbox spawn"), EXIT_NOT_FOUND);

      const provider = providerOrExit(inbox.provider);
      const message = await provider.readMessage(inbox, id);

      let saved: SavedFile[] | undefined;
      if (opts.save !== undefined) {
        const dir = typeof opts.save === "string" && opts.save.length > 0 ? opts.save : "./tossinbox-attachments";
        try {
          saved = await saveMessageContent(provider, inbox, message, dir);
        } catch (err) {
          fail(err);
        }
      }

      if (jsonMode()) {
        out({
          ok: true,
          inbox: inbox.address,
          message: jsonMessage(message, true),
          ...(saved ? { saved } : {}),
        });
        return;
      }
      printMessageHuman(message, true);
      if (opts.html) {
        if (message.html) {
          console.log(`\n${message.html}\n`);
        } else {
          console.error("⚠ this message has no HTML body — showing the plain-text version above");
        }
      }
      if (saved) {
        for (const f of saved) console.log(`  ✔ saved ${f.filename} → ${f.path}`);
      }
    } catch (err) {
      fail(err, err instanceof ProviderError && err.status === 404 ? EXIT_NOT_FOUND : EXIT_ERROR);
    }
  });

program
  .command("wait")
  .description("Wait for a message to arrive (optionally extract the OTP code)")
  .option("-a, --address <address>", "inbox address (defaults to the most recent inbox)")
  .option("-f, --from <sender>", "only match messages from this sender (substring)")
  .option("-s, --subject <text>", "only match messages whose subject contains this text")
  .option("-c, --code", "extract the verification code / OTP from the message")
  .option("-t, --timeout <seconds>", "give up after this many seconds (max 600)", "120")
  .option("-i, --interval <seconds>", "poll interval in seconds", "5")
  .action(async (opts) => {
    try {
      const timeoutSeconds = Number(opts.timeout);
      const intervalSeconds = Number(opts.interval);
      if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 0) {
        fail(new Error(`Invalid --timeout "${opts.timeout}" (expected a number of seconds)`), EXIT_USAGE);
      }
      if (!Number.isFinite(intervalSeconds) || intervalSeconds < 0) {
        fail(new Error(`Invalid --interval "${opts.interval}" (expected a number of seconds)`), EXIT_USAGE);
      }

      const inbox = await resolveInbox(opts.address);
      if (!inbox) fail(new Error("No saved inbox found. Run: tossinbox spawn"), EXIT_NOT_FOUND);

      const provider = providerOrExit(inbox.provider);
      const { timedOut, message } = await waitForMessage(provider, inbox, {
        timeoutSeconds,
        intervalSeconds,
        from: opts.from,
        subject: opts.subject,
      });

      if (timedOut || !message) {
        const detail = `No matching message within ${opts.timeout}s`;
        if (jsonMode()) out({ ok: false, error: "timeout", detail, inbox: inbox.address });
        else console.error(`✖ ${detail}`);
        exitWith(EXIT_TIMEOUT);
      }

      if (jsonMode()) {
        if (opts.code) {
          if (message.code) out({ ok: true, code: message.code, inbox: inbox.address, message: jsonMessage(message) });
          else out({ ok: false, error: "message arrived but no code was detected", message: jsonMessage(message) });
        } else {
          out({ ok: true, inbox: inbox.address, message: jsonMessage(message) });
        }
      } else {
        printMessageHuman(message, false);
        if (opts.code && !message.code) {
          console.error("✖ Message arrived but no verification code was detected");
          exitWith(EXIT_ERROR);
        }
      }
      exitWith(opts.code && !message.code ? EXIT_ERROR : EXIT_OK);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("watch")
  .description(
    "Stream new messages as they arrive — prints each message (and its code when found) and keeps polling until Ctrl-C"
  )
  .option("-a, --address <address>", "inbox address (defaults to the most recent inbox)")
  .option("-f, --from <sender>", "only report messages from this sender (substring)")
  .option("-s, --subject <text>", "only report messages whose subject contains this text")
  .option("-i, --interval <seconds>", "poll interval in seconds", "5")
  .action(async (opts) => {
    try {
      const intervalSeconds = Number(opts.interval);
      if (!Number.isFinite(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 60) {
        fail(new Error(`Invalid --interval "${opts.interval}" (expected seconds between 1 and 60)`), EXIT_USAGE);
      }

      const inbox = await resolveInbox(opts.address);
      if (!inbox) fail(new Error("No saved inbox found. Run: tossinbox spawn"), EXIT_NOT_FOUND);

      const provider = providerOrExit(inbox.provider);

      const matches = (m: { from: string; fromName?: string; subject: string }): boolean => {
        if (opts.from) {
          const hay = `${m.from} ${m.fromName ?? ""}`.toLowerCase();
          if (!hay.includes(opts.from.toLowerCase())) return false;
        }
        if (opts.subject && !m.subject.toLowerCase().includes(opts.subject.toLowerCase())) return false;
        return true;
      };

      // Snapshot what is already in the inbox so only NEW arrivals are
      // reported — re-watching an inbox after a wait must not replay history.
      const seen = new Set<string>();
      try {
        for (const m of await provider.listMessages(inbox)) seen.add(m.id);
      } catch {
        // A failed first poll should not blind the watcher — start empty.
      }

      let stopped = false;
      const stop = (): void => {
        stopped = true;
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);

      if (jsonMode()) {
        // Streaming mode: one compact JSON object per line (NDJSON).
      } else {
        console.error(`👀 watching ${inbox.address} — Ctrl-C to stop`);
      }

      while (!stopped) {
        let summaries;
        try {
          summaries = await provider.listMessages(inbox);
        } catch {
          // Transient provider/network errors: keep polling until stopped.
        }

        if (summaries) {
          for (const summary of summaries) {
            if (seen.has(summary.id) || !matches(summary)) continue;
            seen.add(summary.id);

            // One retry — a transient read error must not swallow a message
            // that may have taken minutes to arrive.
            let message: Message | undefined;
            try {
              message = await provider.readMessage(inbox, summary.id);
            } catch {
              await sleep(1500);
              try {
                message = await provider.readMessage(inbox, summary.id);
              } catch {
                // Report from the summary rather than dropping the event.
              }
            }

            if (jsonMode()) {
              const event: Record<string, unknown> = {
                ok: true,
                event: "message",
                inbox: inbox.address,
                provider: inbox.provider,
                id: summary.id,
                from: summary.from,
                fromName: summary.fromName,
                subject: summary.subject,
                createdAt: summary.createdAt,
                code: message?.code,
                text: message?.text ?? (message?.html ? htmlToText(message.html) : undefined),
                ...(message?.attachments && message.attachments.length > 0
                  ? { attachments: message.attachments.map((a) => ({ filename: a.filename, size: a.size })) }
                  : {}),
              };
              console.log(JSON.stringify(event));
            } else if (message) {
              printMessageHuman(message, false);
            } else {
              console.log(`✔ new message: ${summary.subject}`);
            }
          }
        }

        // Sleep in small slices so Ctrl-C feels instant.
        const deadline = Date.now() + intervalSeconds * 1000;
        while (!stopped && Date.now() < deadline) {
          await sleep(Math.min(200, deadline - Date.now()));
        }
      }

      if (!jsonMode()) console.error("✔ watch stopped");
      exitWith(EXIT_OK);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("inboxes")
  .description("List locally saved inboxes")
  .action(async () => {
    const inboxes = await listSavedInboxes();
    if (jsonMode()) {
      out({ ok: true, count: inboxes.length, inboxes });
      return;
    }
    console.log(`✔ ${inboxes.length} saved inbox(es)`);
    inboxes.forEach((i: Inbox) => {
      console.log(`  - ${i.address} (${i.provider}${i.label ? `, ${i.label}` : ""})`);
    });
  });

program
  .command("toss")
  .description("Delete an inbox (server-side when supported) and remove it from local state")
  .option("-a, --address <address>", "inbox address (defaults to the most recent inbox)")
  .option("--all", "toss every saved inbox")
  .action(async (opts) => {
    try {
      const targets: Inbox[] = [];
      if (opts.all) {
        targets.push(...(await listSavedInboxes()));
      } else {
        const inbox = await resolveInbox(opts.address);
        if (inbox) targets.push(inbox);
      }

      if (targets.length === 0) {
        fail(new Error("Nothing to toss"), EXIT_NOT_FOUND);
      }

      for (const inbox of targets) {
        const provider = providerOrExit(inbox.provider);
        if (provider.destroyInbox) {
          await provider.destroyInbox(inbox);
        }
        await removeInbox(inbox.address);
      }

      if (jsonMode()) {
        out({ ok: true, tossed: targets.map((t) => t.address) });
        return;
      }
      targets.forEach((t) => console.log(`✔ tossed ${t.address}`));
      exitWith(EXIT_OK);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("clear")
  .description("Remove all inboxes from local state (no server-side deletion)")
  .action(async () => {
    const count = await clearInboxes();
    if (jsonMode()) out({ ok: true, removed: count });
    else console.log(`✔ removed ${count} inbox(es) from local state`);
    exitWith(EXIT_OK);
  });

program
  .command("providers")
  .description("List available email providers")
  .action(async () => {
    const all = listProviders();
    if (jsonMode()) {
      out({ ok: true, default: DEFAULT_PROVIDER, providers: all.map((p) => ({ name: p.name, description: p.description })) });
      return;
    }
    console.log(`✔ available providers (default: ${DEFAULT_PROVIDER})`);
    all.forEach((p) => console.log(`  - ${p.name.padEnd(14)} ${p.description}`));
    exitWith(EXIT_OK);
  });

program
  .command("mcp")
  .description("Run the TossInbox MCP server over stdio (for Claude, Cursor, and other MCP clients)")
  .action(async () => {
    const { startMcpServer } = await import("./mcp.js");
    await startMcpServer();
  });

program.exitOverride();
// exitOverride is per-command: apply it to every subcommand too, so bad flags
// surface as CommanderError (-> exit 4) instead of commander's default exit 1.
for (const cmd of program.commands) cmd.exitOverride();
program.parseAsync(process.argv).catch((err) => {
  if (err instanceof CommanderError) {
    // --help / --version exit cleanly even under exitOverride
    if (err.code === "commander.helpDisplayed" || err.code === "commander.help" || err.code === "commander.version") {
      exitWith(EXIT_OK);
    }
    fail(err, EXIT_USAGE); // bad flags / unknown command = usage error
  }
  fail(err);
});
