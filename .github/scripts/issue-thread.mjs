#!/usr/bin/env node
// Prints an issue or pull request and its conversation for a pipeline
// agent, keeping only what trusted authors wrote.
//
// Usage: node issue-thread.mjs <number>
//
// The repository is public, so anyone can comment on its issues, and the
// agents read the whole thread. A comment can carry text that tries to
// pass itself off as an instruction (prompt injection). This script is the
// only way the agents read conversations (the workflow denies them
// `gh issue view --comments` and similar), and it drops comments, reviews
// and review comments whose author is not trusted:
//
//   - trusted: author_association OWNER, MEMBER or COLLABORATOR, or a Bot
//     account (a GitHub App can only write where it is installed, and the
//     pipeline itself writes as github-actions[bot] or the architect App);
//   - the issue body is always shown: a person with write access decided
//     to process the issue by putting the stage label on it.
//
// Omitted entries are counted and their authors listed, never shown.
// Needs gh authenticated (GH_TOKEN in the workflow). The repository comes
// from GITHUB_REPOSITORY or, outside the workflow, from `gh repo view`.

import { execFileSync } from "node:child_process";

const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const number = process.argv[2];
if (!/^\d+$/.test(number ?? "")) {
  console.error("Usage: node issue-thread.mjs <issue-or-pr-number>");
  process.exit(2);
}
// In the workflow GITHUB_REPOSITORY is set; locally, ask gh.
const repo =
  process.env.GITHUB_REPOSITORY ||
  execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], { encoding: "utf8" }).trim();

function api(path) {
  return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
}

function apiAll(path) {
  const items = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = api(`${path}${sep}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

const isTrusted = (entry) =>
  entry.user?.type === "Bot" || TRUSTED_ASSOCIATIONS.has(entry.author_association);

const who = (entry) => `${entry.user?.login ?? "desconocido"} (${entry.author_association ?? "NONE"})`;

const omitted = [];
function keep(entries) {
  return entries.filter((entry) => {
    if (isTrusted(entry)) return true;
    omitted.push(entry.user?.login ?? "desconocido");
    return false;
  });
}

const issue = api(`repos/${repo}/issues/${number}`);
const isPr = Boolean(issue.pull_request);
const out = [];

out.push(`# ${isPr ? "PR" : "Issue"} #${issue.number}: ${issue.title}`);
out.push("");
out.push(`Estado: ${issue.state} · Etiquetas: ${issue.labels.map((l) => l.name).join(", ") || "ninguna"} · Autor: ${who(issue)}`);
out.push("");
out.push("## Descripción");
out.push("");
out.push(issue.body?.trim() || "(sin descripción)");

const events = keep(apiAll(`repos/${repo}/issues/${number}/comments`)).map((c) => ({
  at: c.created_at,
  head: `### Comentario de ${who(c)} · ${c.created_at}`,
  body: c.body,
}));

if (isPr) {
  for (const r of keep(apiAll(`repos/${repo}/pulls/${number}/reviews`))) {
    if (!r.body?.trim()) continue;
    events.push({ at: r.submitted_at, head: `### Revisión ${r.state} de ${who(r)} · ${r.submitted_at}`, body: r.body });
  }
  for (const c of keep(apiAll(`repos/${repo}/pulls/${number}/comments`))) {
    events.push({
      at: c.created_at,
      head: `### Comentario en ${c.path}:${c.line ?? c.original_line ?? "?"} de ${who(c)} · ${c.created_at}`,
      body: c.body,
    });
  }
}

events.sort((a, b) => String(a.at).localeCompare(String(b.at)));

out.push("");
out.push(`## Conversación (${events.length} entradas)`);
for (const e of events) {
  out.push("", e.head, "", e.body?.trim() || "(vacío)");
}

if (omitted.length > 0) {
  const authors = [...new Set(omitted)].join(", ");
  out.push(
    "",
    "## Entradas omitidas",
    "",
    `Se han omitido ${omitted.length} entradas de autores que no son colaboradores del repositorio (${authors}). Su contenido no se muestra.`,
  );
}

console.log(out.join("\n"));
