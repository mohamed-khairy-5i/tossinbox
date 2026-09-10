#!/usr/bin/env node
import { Command } from "commander";
import { DEFAULT_PROVIDER, getProvider, listProviders, listSavedInboxes, removeInbox, clearInboxes, resolveInbox, saveInbox, statePath, waitForMessage, htmlToText, ProviderError, } from "./core/index.js";
const VERSION = "0.1.0";
/* Documented exit codes:
 * 0  success
 * 1  error (provider / network / unexpected)
 * 2  timeout (wait expired without a matching message)
 * 3  not found (no saved inbox, unknown address, or message missing)
 * 4  usage error (bad flags / unknown provider)
 */
const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_TIMEOUT = 2;
const EXIT_NOT_FOUND = 3;
const program = new Command();
program
    .name("tossinbox")
    .description("Disposable email inboxes for humans and AI agents. Spawn an inbox, wait for the OTP, toss it.")
    .version(VERSION)
    .option("--json", "machine-readable JSON output (agent-friendly)");
function jsonMode() {
    return Boolean(program.opts().json);
}
function out(data) {
    console.log(JSON.stringify(data, null, 2));
}
function fail(err, exitCode = EXIT_ERROR) {
    const message = err instanceof Error ? err.message : String(err);
    if (jsonMode()) {
        out({ ok: false, error: message });
    }
    else {
        console.error(`✖ ${message}`);
    }
    process.exit(exitCode);
}
function exitWith(code) {
    process.exit(code);
}
function jsonMessage(message, includeHtml = false) {
    return {
        id: message.id,
        from: message.from,
        fromName: message.fromName,
        subject: message.subject,
        createdAt: message.createdAt,
        code: message.code,
        text: message.text ?? (message.html ? htmlToText(message.html) : undefined),
        html: includeHtml ? message.html : undefined,
    };
}
function printMessageHuman(message, withBody) {
    console.log(`✔ ${message.subject}`);
    console.log(`  from : ${message.fromName ? `${message.fromName} <${message.from}>` : message.from}`);
    if (message.createdAt)
        console.log(`  date : ${message.createdAt}`);
    if (message.code)
        console.log(`  code : ${message.code}`);
    if (withBody) {
        const body = message.text ?? (message.html ? htmlToText(message.html) : "");
        if (body)
            console.log(`\n${body}\n`);
    }
}
/* ------------------------------------------------------------------ */
/* commands                                                            */
/* ------------------------------------------------------------------ */
program
    .command("spawn")
    .description("Create a new disposable inbox")
    .option("-p, --provider <name>", "email provider (see: providers)", DEFAULT_PROVIDER)
    .option("-l, --label <label>", "optional label to identify this inbox")
    .action(async (opts) => {
    try {
        const provider = getProvider(opts.provider);
        const inbox = await provider.createInbox({ label: opts.label });
        await saveInbox(inbox);
        if (jsonMode()) {
            out({ ok: true, inbox });
            return;
        }
        console.log(`✔ Inbox ready : ${inbox.address}`);
        console.log(`  provider    : ${inbox.provider}`);
        if (inbox.label)
            console.log(`  label       : ${inbox.label}`);
        console.log(`  state file  : ${statePath()}`);
    }
    catch (err) {
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
        if (!inbox)
            fail(jsonMode() ? new Error("No saved inbox found. Run: tossinbox spawn") : new Error("No saved inbox found. Run: tossinbox spawn"), EXIT_NOT_FOUND);
        const provider = getProvider(inbox.provider);
        const messages = await provider.listMessages(inbox);
        if (jsonMode()) {
            out({ ok: true, inbox: inbox.address, provider: inbox.provider, count: messages.length, messages });
            return;
        }
        console.log(`✔ ${messages.length} message(s) in ${inbox.address}`);
        messages.forEach((m, i) => {
            console.log(`  ${i + 1}) [${m.id}] ${m.subject}`);
            console.log(`     from: ${m.fromName ? `${m.fromName} <${m.from}>` : m.from}`);
            if (m.intro)
                console.log(`     ${m.intro.slice(0, 100)}`);
        });
    }
    catch (err) {
        fail(err);
    }
});
program
    .command("read <id>")
    .description("Read a full message by id")
    .option("-a, --address <address>", "inbox address (defaults to the most recent inbox)")
    .action(async (id, opts) => {
    try {
        const inbox = await resolveInbox(opts.address);
        if (!inbox)
            fail(new Error("No saved inbox found. Run: tossinbox spawn"), EXIT_NOT_FOUND);
        const provider = getProvider(inbox.provider);
        const message = await provider.readMessage(inbox, id);
        if (jsonMode()) {
            out({ ok: true, inbox: inbox.address, message: jsonMessage(message, true) });
            return;
        }
        printMessageHuman(message, true);
    }
    catch (err) {
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
        const inbox = await resolveInbox(opts.address);
        if (!inbox)
            fail(new Error("No saved inbox found. Run: tossinbox spawn"), EXIT_NOT_FOUND);
        const provider = getProvider(inbox.provider);
        const { timedOut, message } = await waitForMessage(provider, inbox, {
            timeoutSeconds: Number(opts.timeout),
            intervalSeconds: Number(opts.interval),
            from: opts.from,
            subject: opts.subject,
        });
        if (timedOut || !message) {
            const detail = `No matching message within ${opts.timeout}s`;
            if (jsonMode())
                out({ ok: false, error: "timeout", detail, inbox: inbox.address });
            else
                console.error(`✖ ${detail}`);
            exitWith(EXIT_TIMEOUT);
        }
        if (jsonMode()) {
            if (opts.code) {
                if (message.code)
                    out({ ok: true, code: message.code, inbox: inbox.address, message: jsonMessage(message) });
                else
                    out({ ok: false, error: "message arrived but no code was detected", message: jsonMessage(message) });
            }
            else {
                out({ ok: true, inbox: inbox.address, message: jsonMessage(message) });
            }
        }
        else {
            printMessageHuman(message, false);
            if (opts.code && !message.code) {
                console.error("✖ Message arrived but no verification code was detected");
                exitWith(EXIT_ERROR);
            }
        }
        exitWith(opts.code && !message.code ? EXIT_ERROR : EXIT_OK);
    }
    catch (err) {
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
    inboxes.forEach((i) => {
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
        const targets = [];
        if (opts.all) {
            targets.push(...(await listSavedInboxes()));
        }
        else {
            const inbox = await resolveInbox(opts.address);
            if (inbox)
                targets.push(inbox);
        }
        if (targets.length === 0) {
            fail(new Error("Nothing to toss"), EXIT_NOT_FOUND);
        }
        for (const inbox of targets) {
            const provider = getProvider(inbox.provider);
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
    }
    catch (err) {
        fail(err);
    }
});
program
    .command("clear")
    .description("Remove all inboxes from local state (no server-side deletion)")
    .action(async () => {
    const count = await clearInboxes();
    if (jsonMode())
        out({ ok: true, removed: count });
    else
        console.log(`✔ removed ${count} inbox(es) from local state`);
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
program.parseAsync(process.argv).catch((err) => fail(err));
