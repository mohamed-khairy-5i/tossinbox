import { providers } from "./index.js";
import { ProviderError } from "./types.js";
/** A failure that automatic failover is allowed to recover from: network-level
 *  errors (no status) and server-side trouble (5xx) or throttling (429).
 *  A plain 4xx is a real request problem — switching providers cannot fix it. */
function isTransient(err) {
    if (!(err instanceof ProviderError))
        return true; // network-level → transient
    const { status } = err;
    return status === undefined || status === 429 || status >= 500;
}
function describe(err) {
    return err instanceof Error ? err.message : String(err);
}
/**
 * Create an inbox, falling back to other providers when the requested one is
 * down. The requested provider is always tried first; the remaining providers
 * follow registration order (best default first). Every failed attempt is
 * recorded as a warning so humans and agents can see exactly what happened.
 */
export async function createInboxWithFailover(options = {}) {
    const failover = options.failover !== false;
    const requestedName = options.requested ?? Object.keys(providers)[0];
    const requested = providers[requestedName];
    if (!requested) {
        const known = Object.keys(providers).join(", ");
        throw new Error(`Unknown provider "${requestedName}". Available providers: ${known}`);
    }
    // Registration order, requested provider first.
    const candidates = [
        requested,
        ...Object.values(providers).filter((p) => p.name !== requested.name),
    ];
    const warnings = [];
    let firstError;
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        try {
            const inbox = await candidate.createInbox({ label: options.label });
            return {
                inbox,
                switched: i > 0,
                warnings,
            };
        }
        catch (err) {
            firstError ??= err;
            warnings.push(`${candidate.name}: ${describe(err)}`);
            // A non-transient 4xx on the REQUESTED provider is a real request
            // problem (bad payload, blocked domain…) — retrying others would just
            // mask it. Only when the user did not explicitly pick a provider do we
            // fall through anyway, because they never asked for this one by name.
            if (!isTransient(err) && options.requested)
                throw err;
            if (!failover)
                throw err;
        }
    }
    // Every candidate failed. Re-throw the requested provider's original error
    // (it names the provider the user actually asked for) with a failover note.
    const base = describe(firstError);
    const others = candidates.length - 1;
    throw new ProviderError(requestedName, others > 0
        ? `${base} — failover also tried ${others} other provider(s) without success`
        : base);
}
