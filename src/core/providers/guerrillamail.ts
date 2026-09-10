import { ProviderError, type EmailProvider, type Inbox, type Message, type MessageSummary } from "../types.js";
import { extractCode } from "../otp.js";

const BASE = "https://api.guerrillamail.com/ajax.php";

interface GuerrillaAddress {
  email_addr: string;
  sid_token: string;
  email_timestamp?: number;
}

interface GuerrillaEmail {
  mail_id: string | number;
  mail_from?: string;
  mail_subject?: string;
  mail_excerpt?: string;
  mail_body?: string;
  mail_timestamp?: number;
  mail_date?: string;
}

function timestampToIso(ts?: number): string | undefined {
  if (!ts) return undefined;
  // guerrillamail timestamps are in seconds
  return new Date(ts * 1000).toISOString();
}

async function call(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "tossinbox/0.1.0" } });
  if (!res.ok) throw new ProviderError("guerrillamail", `HTTP ${res.status}`, res.status);
  return (await res.json()) as Record<string, unknown>;
}

export const guerrillaMail: EmailProvider = {
  name: "guerrillamail",
  description: "GuerrillaMail — classic disposable email, no API key required",

  async createInbox(options) {
    const data = await call({ f: "get_email_address", lang: "en" });
    const addr = data as unknown as GuerrillaAddress;
    if (!addr.email_addr || !addr.sid_token) {
      throw new ProviderError(this.name, "Unexpected response while creating inbox");
    }
    const inbox: Inbox = {
      provider: this.name,
      address: addr.email_addr,
      label: options?.label,
      session: addr.sid_token,
      createdAt: new Date().toISOString(),
    };
    return inbox;
  },

  async listMessages(inbox) {
    if (!inbox.session) throw new ProviderError(this.name, "Inbox is missing its session token");
    const data = await call({ f: "get_email_list", offset: "0", sid_token: inbox.session });
    const list = (data as unknown as { list?: { list?: GuerrillaEmail[] } }).list?.list ?? [];
    return list.map(
      (m): MessageSummary => ({
        id: String(m.mail_id),
        from: m.mail_from ?? "unknown",
        subject: m.mail_subject ?? "(no subject)",
        intro: m.mail_excerpt,
        createdAt: timestampToIso(m.mail_timestamp),
      })
    );
  },

  async readMessage(inbox, id) {
    if (!inbox.session) throw new ProviderError(this.name, "Inbox is missing its session token");
    const data = await call({ f: "fetch_email", sid_token: inbox.session, email_id: id });
    const m = data as unknown as GuerrillaEmail;
    const message: Message = {
      id: String(m.mail_id ?? id),
      from: m.mail_from ?? "unknown",
      subject: m.mail_subject ?? "(no subject)",
      intro: m.mail_excerpt,
      createdAt: timestampToIso(m.mail_timestamp),
      html: m.mail_body,
    };
    message.code = extractCode(message.html);
    return message;
  },

  async destroyInbox(inbox) {
    if (!inbox.session) return;
    try {
      await call({ f: "forget_me", email_addr: inbox.address, sid_token: inbox.session });
    } catch {
      // best effort
    }
  },
};
