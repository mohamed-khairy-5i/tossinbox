#!/usr/bin/env node
/**
 * TossInbox — site consistency tool.
 *
 * Keeps the mirrored, hand-editable site surfaces from drifting apart:
 *   1. docs/changelog.html + docs/changelog.md  <- regenerated from CHANGELOG.md
 *   2. "## Site" link block in llms.txt         <- mirrored into docs/llms.txt
 *   3. SKILL.md sha256                          <- matches agent-skills/index.json digest
 *   4. npm install forms                        <- bans the slow/unpinned github: form
 *   5. docs/sitemap.xml                         <- must list every public page
 *
 * Usage:
 *   node scripts/sync-site.mjs            # check mode: exit 1 on any drift (CI)
 *   node scripts/sync-site.mjs --fix      # repair everything repairable, then re-check
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = process.argv.includes("--fix");

let failures = 0;
const ok = (msg) => console.log(`  ok   ${msg}`);
const fail = (msg) => { failures += 1; console.log(`  FAIL ${msg}`); };
const fixed = (msg) => console.log(`  fix  ${msg}`);
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

/* ---------- 1. changelog pages are generated from CHANGELOG.md ---------- */

function parseChangelog(md) {
  const versions = [];
  let cur = null;
  let group = null;
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const v = line.match(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})\s*$/);
    if (v) { cur = { version: v[1], date: v[2], groups: [] }; versions.push(cur); group = null; continue; }
    if (!cur) continue;
    const g = line.match(/^### (.+?)\s*$/);
    if (g) { group = { title: g[1], items: [] }; cur.groups.push(group); continue; }
    if (group && /^- /.test(line)) {
      group.items.push(line.slice(2).replace(/\n\s+/g, " "));
    }
  }
  return versions;
}

function inlineToHtml(s) {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderChangelogHtml(versions) {
  const sections = versions.map((v) => {
    const groups = v.groups.map((g) => {
      const items = g.items.map((it) => `        <li>${inlineToHtml(it)}</li>`).join("\n");
      return `      <h3>${g.title}</h3>\n      <ul class="facts">\n${items}\n      </ul>`;
    }).join("\n");
    return `  <section>\n    <div class="wrap">\n      <h2><code>${v.version}</code> <span class="flag"><b>${v.date}</b></span></h2>\n${groups}\n    </div>\n  </section>`;
  }).join("\n\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Changelog · TossInbox</title>
<meta name="description" content="Every notable TossInbox change by version — generated from CHANGELOG.md.">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/png" href="favicon.png">
<meta name="theme-color" content="#0b0e14">
<link rel="canonical" href="https://tossinbox.pages.dev/changelog">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TossInbox">
<meta property="og:title" content="Changelog · TossInbox">
<meta property="og:description" content="Every notable TossInbox change by version.">
<meta property="og:url" content="https://tossinbox.pages.dev/changelog">
<meta property="og:image" content="https://tossinbox.pages.dev/banner.png">
<meta property="og:image:alt" content="TossInbox: disposable email CLI and MCP server">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Changelog · TossInbox">
<meta name="twitter:description" content="Every notable TossInbox change by version.">
<meta name="twitter:image" content="https://tossinbox.pages.dev/banner.png">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "docs", "item": "https://tossinbox.pages.dev/"},
    {"@type": "ListItem", "position": 2, "name": "changelog", "item": "https://tossinbox.pages.dev/changelog"}
  ]
}
</script>
<link rel="stylesheet" href="style.css">
<script src="main.js" defer></script>
</head>
<body>

<a class="skip" href="#main">Skip to content</a>

<nav>
  <div class="wrap">
    <a class="brand" href="/"><img src="logo.png" alt="TossInbox" width="26" height="26"> <span aria-hidden="true">TossInbox</span></a>
    <span class="nav-links">
      <a href="/#install">Install</a>
      <a href="quickstart">Quickstart</a>
      <a href="cli">CLI</a>
      <a href="agents">Agents</a>
      <a href="examples">Examples</a>
      <a href="guide">Guide</a>
      <a href="faq">FAQ</a>
      <a href="changelog" aria-current="page">Changelog</a>
      <a class="nav-gh" href="https://github.com/mohamed-khairy-5i/tossinbox">GitHub</a>
    </span>
  </div>
</nav>

<main id="main">

  <header class="page-head">
    <div class="wrap">
      <p class="crumbs"><a href="/">docs</a><span class="sep">/</span>changelog</p>
      <h1>Changelog</h1>
      <p class="page-lead">Every notable change, newest first. Generated from the repo's
      <a href="https://github.com/mohamed-khairy-5i/tossinbox/blob/main/CHANGELOG.md">CHANGELOG.md</a> —
      this page is a build artifact, edit the source file instead. Full diffs in
      <a href="https://github.com/mohamed-khairy-5i/tossinbox/releases">releases</a>.</p>
    </div>
  </header>

${sections}

  <div class="wrap wrap--footer">
    <nav class="pager" aria-label="Docs pagination">
      <a class="prev" href="roadmap"><span class="dir">←</span>roadmap</a>
      <a class="next" href="faq">FAQ<span class="dir">→</span></a>
    </nav>
  </div>

</main>

<footer>
  <div class="wrap">
    <span class="foot-legal">MIT License © 2026 <a href="https://github.com/mohamed-khairy-5i">Mohamed Khairy</a></span>
    <span class="foot-links">
      <a href="https://github.com/mohamed-khairy-5i/tossinbox">GitHub</a>
      <a href="https://github.com/mohamed-khairy-5i/tossinbox/releases">Releases</a>
      <a href="llms.txt">llms.txt</a>
      <a href="https://github.com/mohamed-khairy-5i/tossinbox/issues">Issues</a>
      <a href="#main">top ↑</a>
    </span>
  </div>
</footer>

</body>
</html>
`;
}

function renderChangelogMd(versions) {
  const body = versions.map((v) => {
    const groups = v.groups.map((g) => {
      const items = g.items.map((it) => `- ${it}`).join("\n");
      return `### ${g.title}\n\n${items}`;
    }).join("\n\n");
    return `## ${v.version} - ${v.date}\n\n${groups}`;
  }).join("\n\n");

  return `# Changelog

Every notable TossInbox change, newest first. Generated from the repo's
CHANGELOG.md (edit that file, not this page). Full diffs:
https://github.com/mohamed-khairy-5i/tossinbox/releases

${body}

MIT License © 2026 Mohamed Khairy
`;
}

console.log("changelog pages vs CHANGELOG.md");
{
  const versions = parseChangelog(read("CHANGELOG.md"));
  const wantHtml = renderChangelogHtml(versions);
  const wantMd = renderChangelogMd(versions);
  let haveHtml = "";
  let haveMd = "";
  try { haveHtml = read("docs/changelog.html"); } catch {}
  try { haveMd = read("docs/changelog.md"); } catch {}
  if (haveHtml === wantHtml && haveMd === wantMd) {
    ok("docs/changelog.html + docs/changelog.md match CHANGELOG.md");
  } else if (FIX) {
    writeFileSync(path.join(ROOT, "docs/changelog.html"), wantHtml);
    writeFileSync(path.join(ROOT, "docs/changelog.md"), wantMd);
    fixed("regenerated docs/changelog.html + docs/changelog.md");
  } else {
    fail("docs/changelog.html or docs/changelog.md drifted — run: node scripts/sync-site.mjs --fix");
  }
}

/* ---------- 2. "## Site" block parity between llms.txt and docs/llms.txt ---------- */

function siteBlock(txt) {
  const m = txt.match(/^## Site\n\n((?:- .*\n?)+)/m);
  return m ? m[1].split("\n").map((l) => l.trim()).filter(Boolean).join("\n") : null;
}

console.log('llms.txt "## Site" block parity');
{
  const rootBlock = siteBlock(read("llms.txt"));
  const docsBlock = siteBlock(read("docs/llms.txt"));
  if (rootBlock === null || docsBlock === null) {
    fail('missing "## Site" block in llms.txt or docs/llms.txt');
  } else if (rootBlock === docsBlock) {
    ok("Site blocks are identical");
  } else if (FIX) {
    const updated = read("docs/llms.txt").replace(/^## Site\n\n(?:- .*\n?)+/m, `## Site\n\n${rootBlock}\n`);
    writeFileSync(path.join(ROOT, "docs/llms.txt"), updated);
    fixed("synced docs/llms.txt Site block from root llms.txt");
  } else {
    fail('Site blocks differ between llms.txt and docs/llms.txt — run: node scripts/sync-site.mjs --fix');
  }
}

/* ---------- 3. SKILL.md digest matches agent-skills/index.json ---------- */

console.log("SKILL.md digest vs agent-skills/index.json");
try {
  const skill = read("docs/.well-known/agent-skills/tossinbox/SKILL.md");
  const live = createHash("sha256").update(skill).digest("hex");
  const idx = JSON.parse(read("docs/.well-known/agent-skills/index.json"));
  const recorded = (idx.skills?.[0]?.digest || "").replace(/^sha256:/, "");
  if (live === recorded) {
    ok(`digest ${recorded.slice(0, 12)}… matches`);
  } else {
    fail(`SKILL.md sha256 ${live.slice(0, 12)}… != index.json digest ${recorded.slice(0, 12)}… (refresh index.json)`);
  }
} catch (e) {
  fail(`could not verify digest: ${e.message}`);
}

/* ---------- 4. npm install forms everywhere (no github: registry forms) ---------- */

console.log("install forms lint (npm registry forms only)");
{
  const files = [
    "README.md", "llms.txt", "docs/llms.txt",
    "docs/index.md", "docs/quickstart.md", "docs/cli.md", "docs/agents.md", "docs/faq.md", "docs/auth.md",
    "docs/examples.md", "docs/guide.md", "docs/changelog.md", "docs/roadmap.md",
    "docs/.well-known/mcp/server-card.json", "docs/.well-known/agent-skills/tossinbox/SKILL.md",
  ];
  let hits = 0;
  for (const f of files) {
    let txt = "";
    try { txt = read(f); } catch { continue; }
    if (/github:mohamed-khairy-5i\/tossinbox/.test(txt)) { hits += 1; fail(`${f}: stale github: install form`); }
  }
  if (hits === 0) ok("all install forms use the npm registry package");
}

/* ---------- 5. sitemap lists every public page ---------- */

console.log("docs/sitemap.xml coverage");
{
  const sitemap = read("docs/sitemap.xml");
  const pages = ["", "quickstart", "cli", "agents", "faq", "examples", "guide", "changelog", "roadmap", "ar/"];
  const missing = pages.filter((p) => !sitemap.includes(`<loc>https://tossinbox.pages.dev/${p}</loc>`));
  if (missing.length === 0) {
    ok(`all ${pages.length} pages listed`);
  } else {
    fail(`sitemap missing: ${missing.join(", ")}`);
  }
}

/* ---------- summary ---------- */

console.log(failures === 0 ? "\nsite sync: all checks passed" : `\nsite sync: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
