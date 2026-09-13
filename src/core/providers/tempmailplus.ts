import { randomBytes } from "node:crypto";
import { ProviderError, type EmailProvider, type Inbox, type Message, type MessageSummary } from "../types.js";
import { extractCode } from "../otp.js";
import { networkError } from "../net.js";
import { VERSION } from "../../version.js";

const BASE = "https://tempmail.plus";
const HOST = "tempmail.plus";
const REQUEST_TIMEOUT_MS = 20_000;

/** Public domains advertised by the tempmail.plus web client. The first one
 *  is the service default and is the one TossInbox spawns on. */
const DOMAIN = "mailto.plus";

interface PlusMail {
  id: number | string;
  from?: string;
  from_name?: string;
  subject?: string;
  time?: number;
}

interface PlusListResponse {
  mail_list?: PlusMail[];
  first_id?: number;
  last_id?: number;
}

interface PlusMessageResponse extends PlusMail {
  result?: boolean;
  text?: string;
  html?: string;
}

function randomUser(length = 12): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function timeToIso(ts?: number): string | undefined {
  if (!ts) return undefined;
  // Guard against seconds vs milliseconds epochs
  return new Date(ts < 1e12 ? ts * 1000 : ts).toISOString();
}

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "User-Agent": `tossinbox/${VERSION}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch((err: unknown) => {
    throw networkError(err, "tempmailplus", HOST, REQUEST_TIMEOUT_MS);
  });
  if (res.status >= 500) {
    throw new ProviderError(
      "tempmailplus",
      `HTTP ${res.status} from ${HOST} — provider is down or having trouble; retry, or switch with --provider`,
      res.status
    );
  }
  return res;
}

async function callJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await call(method, path, body);
  if (!res.ok) {
    let detail = "";
    try {
      const data = (await res.json()) as Record<string, unknown>;
      if (typeof data.message === "string") detail = `: ${data.message}`;
    } catch {
      // ignore body parse errors
    }
    throw new ProviderError("tempmailplus", `HTTP ${res.status}${detail}`, res.status);
  }
  return (await res.json()) as T;
}

/** tempmail.plus inboxes are deterministic: any address on a public domain
 *  exists and can be read by anyone who knows it. Spawn mints a fresh random
 *  local part; messages are then fetched by address. */
export const tempmailPlus: EmailProvider = {
  name: "tempmailplus",
  description: "tempmail.plus — pick-your-name inbox on 9 public domains, no API key required",

  async createInbox(options) {
    const inbox: Inbox = {
      provider: this.name,
      address: `${randomUser()}@${DOMAIN}`,
      label: options?.label,
      createdAt: new Date().toISOString(),
    };
    return inbox;
  },

  async listMessages(inbox) {
    const data = await callJson<PlusListResponse>(
      "GET",
      `/api/mails/?email=${encodeURIComponent(inbox.address)}&first_id=0`
    );
    return (data.mail_list ?? []).map(
      (m): MessageSummary => ({
        id: String(m.id),
        from: m.from ?? "unknown",
        fromName: m.from_name,
        subject: m.subject ?? "(no subject)",
        createdAt: timeToIso(m.time),
      })
    );
  },

  async readMessage(inbox, id) {
    const data = await callJson<PlusMessageResponse>(
      "GET",
      `/api/mails/${encodeURIComponent(id)}?email=${encodeURIComponent(inbox.address)}&first_id=-1`
    );
    if (!data.result) {
      throw new ProviderError(
        "tempmailplus",
        "Message not found — re-list messages to see what is currently in the inbox"
      );
    }
    const message: Message = {
      id,
      from: data.from ?? "unknown",
      fromName: data.from_name,
      subject: data.subject ?? "(no subject)",
      createdAt: timeToIso(data.time),
      text: data.text,
      html: data.html,
    };
    message.code = extractCode(message.text) ?? extractCode(message.html);
    return message;
  },

  async destroyInbox(inbox) {
    try {
      const data = await callJson<PlusListResponse>(
        "GET",
        `/api/mails/?email=${encodeURIComponent(inbox.address)}&first_id=0`
      );
      const list = data.mail_list ?? [];
      if (list.length === 0) return;
      await call("DELETE", "/api/mails", {
        email: inbox.address,
        first_id: data.first_id ?? 0,
        last_id: data.last_id ?? 0,
        force: true,
      });
    } catch {
      // best effort: local removal always happens regardless
    }
  },
};
