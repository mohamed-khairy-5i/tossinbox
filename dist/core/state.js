import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
export function statePath() {
    return process.env.TOSSINBOX_STATE || path.join(os.homedir(), ".tossinbox", "state.json");
}
export async function loadState() {
    let raw;
    try {
        raw = await fs.readFile(statePath(), "utf8");
    }
    catch (err) {
        // Only a missing file means "no state yet" — anything else must be loud,
        // otherwise the next write would silently destroy saved inboxes.
        const code = err.code;
        if (code === "ENOENT")
            return { inboxes: [] };
        throw new Error(`Cannot read state file ${statePath()} (${err.message}). ` +
            "Fix its permissions or point TOSSINBOX_STATE at a writable path.");
    }
    try {
        const parsed = JSON.parse(raw);
        return { inboxes: Array.isArray(parsed.inboxes) ? parsed.inboxes : [] };
    }
    catch {
        throw new Error(`State file ${statePath()} is not valid JSON. ` +
            "Refusing to overwrite it — fix or delete the file manually (it may contain inboxes you still need).");
    }
}
export async function saveInbox(inbox) {
    const state = await loadState();
    const filtered = state.inboxes.filter((i) => i.address !== inbox.address);
    filtered.push(inbox);
    await writeState({ inboxes: filtered });
}
export async function removeInbox(address) {
    const state = await loadState();
    const before = state.inboxes.length;
    const filtered = state.inboxes.filter((i) => i.address !== address);
    await writeState({ inboxes: filtered });
    return filtered.length < before;
}
export async function clearInboxes() {
    const state = await loadState();
    const count = state.inboxes.length;
    await writeState({ inboxes: [] });
    return count;
}
export async function listSavedInboxes() {
    const state = await loadState();
    return [...state.inboxes].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}
/** Resolve the inbox to operate on: an explicit address, or the most recent one. */
export async function resolveInbox(address) {
    const inboxes = await listSavedInboxes();
    if (address) {
        const needle = address.trim().toLowerCase();
        return inboxes.find((i) => i.address.toLowerCase() === needle);
    }
    return inboxes.length > 0 ? inboxes[inboxes.length - 1] : undefined;
}
async function writeState(state) {
    const file = statePath();
    // The state file contains provider tokens — keep it private.
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await fs.writeFile(file, JSON.stringify(state, null, 2) + "\n", "utf8");
    // writeFile's mode option only applies at creation — enforce on every write.
    await fs.chmod(file, 0o600);
}
