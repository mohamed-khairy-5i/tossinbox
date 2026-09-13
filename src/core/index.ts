import type { EmailProvider } from "./types.js";
import { mailTm, mailGw } from "./providers/mailtm.js";
import { guerrillaMail } from "./providers/guerrillamail.js";

export * from "./types.js";
export { extractCode, htmlToText } from "./otp.js";
export * from "./state.js";
export { waitForMessage, sleep } from "./wait.js";

export const providers: Record<string, EmailProvider> = {
  [mailTm.name]: mailTm,
  [mailGw.name]: mailGw,
  [guerrillaMail.name]: guerrillaMail,
};

export const DEFAULT_PROVIDER = mailTm.name;

export function getProvider(name?: string): EmailProvider {
  const key = (name || DEFAULT_PROVIDER).toLowerCase();
  const provider = providers[key];
  if (!provider) {
    const known = Object.values(providers)
      .map((p) => p.name)
      .join(", ");
    throw new Error(`Unknown provider "${name}". Available providers: ${known}`);
  }
  return provider;
}

export function listProviders(): EmailProvider[] {
  return Object.values(providers);
}
