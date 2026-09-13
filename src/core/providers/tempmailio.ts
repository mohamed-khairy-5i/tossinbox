import { ProviderError, type Attachment, type EmailProvider, type Inbox, type Message, type MessageSummary } from "../types.js";
import { extractCode } from "../otp.js";
import { networkError } from "../net.js";
import { VERSION } from "../../version.js";

const BASE = "https://api.internal.temp-mail.io";
const HOST = "api.internal.temp-mail.io";
const REQUEST_TIMEOUT_MS = 20_000;

interface IoAttachment {
  id?: string | number;
  filename?: string;
  name?: string;
  size?: number;
  content_type?: string;
  contentType?: string;
  type?: string;
  url?: string;
}

interface IoEmail {
  mail_id?: string | number;
  id?: string | number;
  from?: string;
  from_name?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  attachments?: IoAttachment[];
  created_at?: string;
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
    throw networkError(err, "tempmailio", HOST, REQUEST_TIMEOUT_MS);
  });
  if (res.status >= 500) {
    throw new ProviderError(
      "tempmailio",
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
    throw new ProviderError("tempmailio", `HTTP ${res.status}${detail}`, res.status);
  }
  return (await res.json()) as T;
}

/** The messages endpoint returns full bodies, so readMessage re-lists and picks.
 *  A brand-new address can transiently 400 with "Email not found" right after
 *  creation (eventual consistency upstream) — retry once before giving up. */
async function fetchMessages(address: string): Promise<IoEmail[]> {
  try {
    return await callJson<IoEmail[]>(
      "GET",
      `/api/v3/email/${encodeURIComponent(address)}/messages`
    );
  } catch (err) {
    if (err instanceof ProviderError && err.status === 400) {
      await new Promise((r) => setTimeout(r, 1200));
      return callJson<IoEmail[]>(
        "GET",
        `/api/v3/email/${encodeURIComponent(address)}/messages`
      );
    }
    throw err;
  }
}

/** The v3 API attachment objects vary between deployments; parse defensively. */
function toAttachment(a: IoAttachment): Attachment {
  return {
    id: a.id !== undefined ? String(a.id) : undefined,
    filename: a.filename ?? a.name ?? "attachment.bin",
    contentType: a.contentType ?? a.content_type ?? a.type,
    size: a.size,
    url: a.url,
  };
}

export const tempmailIo: EmailProvider = {
  name: "tempmailio",
  description: "temp-mail.io — disposable email with 10+ rotating domains, no API key required",

  async createInbox(options) {
    const data = await callJson<{ email?: string; token?: string }>(
      "POST",
      "/api/v3/email/new",
      { min_name_length: 10, max_name_length: 10 }
    );
    if (!data.email || !data.token) {
      throw new ProviderError("tempmailio", "Unexpected response while creating inbox");
    }
    const inbox: Inbox = {
      provider: this.name,
      address: data.email,
      label: options?.label,
      token: data.token,
      createdAt: new Date().toISOString(),
    };
    return inbox;
  },

  async listMessages(inbox) {
    const list = await fetchMessages(inbox.address);
    return list.map(
      (m, i): MessageSummary => ({
        id: String(m.mail_id ?? m.id ?? i),
        from: m.from ?? "unknown",
        fromName: m.from_name,
        subject: m.subject ?? "(no subject)",
        intro: m.body_text ? m.body_text.slice(0, 120) : undefined,
        createdAt: m.created_at,
      })
    );
  },

  async readMessage(inbox, id) {
    const list = await fetchMessages(inbox.address);
    const email = list.find((m, i) => String(m.mail_id ?? m.id ?? i) === id);
    if (!email) {
      throw new ProviderError(
        "tempmailio",
        "Message not found — re-list messages to see what is currently in the inbox"
      );
    }
    const message: Message = {
      id,
      from: email.from ?? "unknown",
      fromName: email.from_name,
      subject: email.subject ?? "(no subject)",
      intro: email.body_text ? email.body_text.slice(0, 120) : undefined,
      createdAt: email.created_at,
      text: email.body_text,
      html: email.body_html,
      ...((email.attachments ?? []).length > 0
        ? { attachments: (email.attachments ?? []).map(toAttachment) }
        : {}),
    };
    message.code = extractCode(message.text) ?? extractCode(message.html);
    return message;
  },

  async downloadAttachment(_inbox, _messageId, attachment) {
    if (!attachment.url) {
      throw new ProviderError(
        "tempmailio",
        `temp-mail.io did not expose a download URL for "${attachment.filename}" — open the message in the provider UI to retrieve it`
      );
    }
    const res = await fetch(attachment.url, {
      headers: { Accept: "*/*", "User-Agent": `tossinbox/${VERSION}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((err: unknown) => {
      throw networkError(err, "tempmailio", HOST, REQUEST_TIMEOUT_MS);
    });
    if (!res.ok) {
      throw new ProviderError(
        "tempmailio",
        `HTTP ${res.status} while downloading "${attachment.filename}"`,
        res.status
      );
    }
    return Buffer.from(await res.arrayBuffer());
  },

  async destroyInbox(inbox) {
    if (!inbox.token) return;
    try {
      await call("DELETE", `/api/v3/email/${encodeURIComponent(inbox.address)}`, {
        token: inbox.token,
      });
    } catch {
      // best effort: local removal always happens regardless
    }
  },
};
