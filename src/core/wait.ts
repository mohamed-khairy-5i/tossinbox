import type { EmailProvider, Inbox, Message } from "./types.js";

export interface WaitOptions {
  timeoutSeconds?: number;
  intervalSeconds?: number;
  /** Match messages whose "from" (address or name) contains this substring */
  from?: string;
  /** Match messages whose subject contains this substring */
  subject?: string;
}

export interface WaitResult {
  timedOut: boolean;
  message?: Message;
}

/**
 * Poll the inbox until a matching message arrives or the timeout expires.
 * Transient provider errors are swallowed and retried until the deadline.
 */
export async function waitForMessage(
  provider: EmailProvider,
  inbox: Inbox,
  options: WaitOptions = {}
): Promise<WaitResult> {
  const timeoutSeconds = Math.max(1, Math.min(options.timeoutSeconds ?? 120, 600));
  const intervalSeconds = Math.max(1, Math.min(options.intervalSeconds ?? 5, 60));
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    let summaries;
    try {
      summaries = await provider.listMessages(inbox);
    } catch {
      await sleep(Math.min(intervalSeconds * 1000, deadline - Date.now()));
      continue;
    }

    const matched = summaries.find((m) => {
      if (options.from) {
        const hay = `${m.from} ${m.fromName ?? ""}`.toLowerCase();
        if (!hay.includes(options.from.toLowerCase())) return false;
      }
      if (options.subject && !m.subject.toLowerCase().includes(options.subject.toLowerCase())) {
        return false;
      }
      return true;
    });

    if (matched) {
      // One retry after a short delay — a transient read error should not
      // throw away a wait that may have taken minutes.
      try {
        const message = await provider.readMessage(inbox, matched.id);
        return { timedOut: false, message };
      } catch {
        await sleep(1500);
        const message = await provider.readMessage(inbox, matched.id);
        return { timedOut: false, message };
      }
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(intervalSeconds * 1000, remaining));
  }

  return { timedOut: true };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
