import { ProviderError } from "./types.js";

interface FailureShape {
  name?: string;
  message?: string;
  cause?: { name?: string; code?: string; message?: string };
}

/** Translate Node's raw fetch failures into a ProviderError that says what
 *  actually happened and what to do next. Without this, a DNS blip or a dead
 *  upstream surfaces as Node's bare "fetch failed" — useless to humans and
 *  unparsable for agents. Messages stay short, actionable, and stable. */
export function networkError(
  err: unknown,
  provider: string,
  host: string,
  timeoutMs: number
): ProviderError {
  const failure = (err ?? {}) as FailureShape;
  const cause = failure.cause ?? {};
  const code = cause.code ?? "";

  // AbortSignal.timeout rejects with a DOMException named "TimeoutError"
  // (sometimes wrapped as the fetch cause).
  if (
    failure.name === "TimeoutError" ||
    cause.name === "TimeoutError" ||
    code === "UND_ERR_HEADERS_TIMEOUT"
  ) {
    return new ProviderError(
      provider,
      `no response from ${host} within ${Math.round(timeoutMs / 1000)}s — ` +
        "provider is down or unreachable; retry, or switch with --provider"
    );
  }

  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return new ProviderError(
        provider,
        `DNS lookup failed for ${host} — no internet, bad DNS, or a blocked ` +
          "network; check connectivity and retry"
      );
    case "ECONNREFUSED":
      return new ProviderError(
        provider,
        `connection refused by ${host} — provider may be down, or a ` +
          "firewall/proxy is blocking it; retry later"
      );
    case "ECONNRESET":
    case "EPIPE":
      return new ProviderError(
        provider,
        `connection to ${host} dropped mid-request — usually transient; retry`
      );
    case "ENETUNREACH":
    case "ENETDOWN":
    case "EHOSTUNREACH":
      return new ProviderError(
        provider,
        "network unreachable — you appear to be offline; check your connection and retry"
      );
    case "ECONNABORTED":
      return new ProviderError(
        provider,
        `connection to ${host} aborted — usually transient; retry`
      );
    case "CERT_HAS_EXPIRED":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      return new ProviderError(
        provider,
        `TLS certificate problem with ${host} — if a corporate proxy ` +
          "intercepts TLS, point NODE_EXTRA_CA_CERTS at its CA bundle"
      );
    default: {
      const detail = cause.message || failure.message || String(err);
      return new ProviderError(
        provider,
        `cannot reach ${host} (${detail}) — check connectivity and retry`
      );
    }
  }
}
