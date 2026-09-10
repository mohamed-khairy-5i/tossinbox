/**
 * Poll the inbox until a matching message arrives or the timeout expires.
 * Transient provider errors are swallowed and retried until the deadline.
 */
export async function waitForMessage(provider, inbox, options = {}) {
    const timeoutSeconds = Math.max(1, Math.min(options.timeoutSeconds ?? 120, 600));
    const intervalSeconds = Math.max(1, Math.min(options.intervalSeconds ?? 5, 60));
    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
        let summaries;
        try {
            summaries = await provider.listMessages(inbox);
        }
        catch {
            await sleep(Math.min(intervalSeconds * 1000, deadline - Date.now()));
            continue;
        }
        const matched = summaries.find((m) => {
            if (options.from) {
                const hay = `${m.from} ${m.fromName ?? ""}`.toLowerCase();
                if (!hay.includes(options.from.toLowerCase()))
                    return false;
            }
            if (options.subject && !m.subject.toLowerCase().includes(options.subject.toLowerCase())) {
                return false;
            }
            return true;
        });
        if (matched) {
            const message = await provider.readMessage(inbox, matched.id);
            return { timedOut: false, message };
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0)
            break;
        await sleep(Math.min(intervalSeconds * 1000, remaining));
    }
    return { timedOut: true };
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
