/**
 * TossInbox — Markdown for Agents (content negotiation).
 *
 * When a client sends `Accept: text/markdown` for a documentation page,
 * serve the Markdown mirror of that page with `Content-Type: text/markdown`.
 * Browsers (which never send text/markdown) keep getting the HTML unchanged,
 * and all other requests fall through to static asset serving untouched.
 */

const MD_MAP = {
  "/": "/index.md",
  "/index.html": "/index.md",
  "/quickstart": "/quickstart.md",
  "/quickstart.html": "/quickstart.md",
  "/cli": "/cli.md",
  "/cli.html": "/cli.md",
  "/agents": "/agents.md",
  "/agents.html": "/agents.md",
  "/faq": "/faq.md",
  "/faq.html": "/faq.md",
  "/examples": "/examples.md",
  "/examples.html": "/examples.md",
  "/guide": "/guide.md",
  "/guide.html": "/guide.md",
  "/changelog": "/changelog.md",
  "/changelog.html": "/changelog.md",
  "/roadmap": "/roadmap.md",
  "/roadmap.html": "/roadmap.md",
};

export const onRequest = async ({ request, env, next }) => {
  if (request.method !== "GET" && request.method !== "HEAD") return next();

  const accept = request.headers.get("accept") || "";
  const wantsMarkdown = accept
    .split(",")
    .some((part) => part.trim().toLowerCase().split(";")[0] === "text/markdown");
  if (!wantsMarkdown) return next();

  const url = new URL(request.url);
  const mdPath = MD_MAP[url.pathname];
  if (!mdPath) return next();

  const res = await env.ASSETS.fetch(new Request(new URL(mdPath, url.origin)));
  if (!res || !res.ok) return next();

  // Inherit the headers the static asset response already carries (CSP, HSTS,
  // X-Frame-Options, Referrer-Policy, ...) instead of rebuilding from scratch —
  // otherwise agent-preferred text/markdown responses lose every security
  // header and the Link header used for discovery.
  const headers = new Headers(res.headers);
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return new Response(res.body, { status: 200, headers });
};
