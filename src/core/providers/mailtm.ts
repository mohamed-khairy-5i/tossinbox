import { ProviderError, type EmailProvider, type Inbox, type Message, type MessageSummary } from "../types.js";
import { extractCode } from "../otp.js";

const BASE = "https://api.mail.tm";

interface MailTmDomain {
  domain: string;
  isActive: boolean;
  isPrivate: boolean;
}

interface MailTmMessage {
  id: string;
  from?: { address?: string; name?: string };
  to?: Array<{ address?: string; name?: string }>;
  subject?: string;
  intro?: string;
  text?: string;
  html?: string[];
  createdAt?: string;
}

function randomUser(length = 12): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function randomPassword(length = 16): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "tossinbox/0.1.0",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** mail.tm allows ~8 requests per second; retry once on 429. */
async function request(
  method: string,
  url: string,
  options: { token?: string; body?: unknown } = {}
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: { ...headers(options.token), ...(options.body ? { "Content-Type": "application/json" } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  let res = await fetch(url, init);
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(url, init);
  }
  return res;
}

async function parseJson<T>(res: Response, provider: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as Record<string, unknown>;
      const msg = body["hydra:description"] ?? body.message ?? body.detail;
      if (typeof msg === "string") detail = `: ${msg}`;
    } catch {
      // ignore body parse errors
    }
    throw new ProviderError(provider, `HTTP ${res.status}${detail}`, res.status);
  }
  return (await res.json()) as T;
}

/** mail.tm returns a plain array with Accept: application/json and a hydra
 *  collection with Accept: application/ld+json — normalize both. */
async function parseCollection<T>(res: Response, provider: string): Promise<T[]> {
  const data = await parseJson<unknown>(res, provider);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const member = obj["hydra:member"] ?? obj.member;
    if (Array.isArray(member)) return member as T[];
  }
  throw new ProviderError(provider, "Unexpected collection response shape");
}

export const mailTm: EmailProvider = {
  name: "mailtm",
  description: "mail.tm — free disposable email, no API key required",

  async createInbox(options) {
    const domainsRes = await request("GET", `${BASE}/domains?page=1`);
    const domains = await parseCollection<MailTmDomain>(domainsRes, this.name);
    const domain = domains.find((d) => d.isActive && !d.isPrivate)?.domain;
    if (!domain) {
      throw new ProviderError(this.name, "No active public domain available on mail.tm");
    }

    const address = `${randomUser()}@${domain}`;
    const password = randomPassword();

    const accountRes = await request("POST", `${BASE}/accounts`, { body: { address, password } });
    const account = await parseJson<{ id: string; address: string }>(accountRes, this.name);

    const tokenRes = await request("POST", `${BASE}/token`, { body: { address, password } });
    const auth = await parseJson<{ token: string; id: string }>(tokenRes, this.name);

    const inbox: Inbox = {
      provider: this.name,
      address: account.address || address,
      label: options?.label,
      token: auth.token,
      password,
      accountId: account.id || auth.id,
      createdAt: new Date().toISOString(),
    };
    return inbox;
  },

  async listMessages(inbox) {
    if (!inbox.token) throw new ProviderError(this.name, "Inbox is missing its API token");
    const res = await request("GET", `${BASE}/messages?page=1`, { token: inbox.token });
    const data = await parseCollection<MailTmMessage>(res, this.name);
    return data.map(
      (m): MessageSummary => ({
        id: m.id,
        from: m.from?.address ?? "unknown",
        fromName: m.from?.name,
        subject: m.subject ?? "(no subject)",
        intro: m.intro,
        createdAt: m.createdAt,
      })
    );
  },

  async readMessage(inbox, id) {
    if (!inbox.token) throw new ProviderError(this.name, "Inbox is missing its API token");
    const res = await request("GET", `${BASE}/messages/${encodeURIComponent(id)}`, { token: inbox.token });
    const m = await parseJson<MailTmMessage>(res, this.name);
    const html = m.html && m.html.length > 0 ? m.html.join("\n") : undefined;
    const message: Message = {
      id: m.id,
      from: m.from?.address ?? "unknown",
      fromName: m.from?.name,
      subject: m.subject ?? "(no subject)",
      intro: m.intro,
      createdAt: m.createdAt,
      text: m.text,
      html,
    };
    message.code = extractCode(message.text) ?? extractCode(message.html);
    return message;
  },

  async destroyInbox(inbox) {
    if (!inbox.token || !inbox.accountId) return;
    try {
      await request("DELETE", `${BASE}/accounts/${encodeURIComponent(inbox.accountId)}`, {
        token: inbox.token,
      });
    } catch {
      // best effort: local removal always happens regardless
    }
  },
};
