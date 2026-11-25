#!/usr/bin/env node
// Runs one pipeline agent (`claude -p ...`) and stops it before it uses up
// the Claude subscription.
//
// Usage: node run-agent.mjs <answer-file> <claude args...>
//   e.g. node run-agent.mjs /tmp/plan.md -p "$PROMPT" --agent developer
//
// Claude Code, in stream-json mode, emits a `rate_limit_event` whenever the
// subscription usage changes, with the utilization (0..1) of the 5-hour
// window and of the weekly window. When either reaches its threshold
// (AGENT_MAX_FIVE_HOUR_PCT / AGENT_MAX_SEVEN_DAY_PCT, default 90%), or the
// subscription rejects a request, the agent is interrupted.
//
// Every agent also ends its answer with a status line (the protocol is
// appended to its system prompt, see STATUS_PROTOCOL):
//   ESTADO: COMPLETADO  it did what the stage asked
//   ESTADO: PREGUNTA    it needs a decision from a person
//   ESTADO: BLOQUEADO   it could not finish (permissions, errors, specs...)
// The line is removed from the answer. Anything other than COMPLETADO,
// including a missing line, stops the stage: an agent that crashes,
// gets confused or forgets the protocol never lets half-done work move on.
//
// Exit codes:
//   0  the agent finished (ESTADO: COMPLETADO); its answer is in <answer-file>
//   1  the agent failed for any other reason
//   75 stopped by the usage limit; <answer-file> and
//      $RUNNER_TEMP/usage-limit.md hold a note (in Spanish) for the issue
//      with the usage and the time it resets. Later steps check that file
//      so the issue keeps its label and nothing moves on.
//   78 the agent stopped the stage (ESTADO: PREGUNTA or BLOQUEADO, or no
//      status line). $RUNNER_TEMP/agent-state holds PREGUNTA or BLOQUEADO;
//      <answer-file> and $RUNNER_TEMP/agent-stopped.md hold the answer with
//      a note (in Spanish) on top. Later steps check agent-state so nothing
//      moves on; .github/scripts/agent-stop.sh labels the issue.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const EXIT_USAGE_LIMIT = 75;
const EXIT_AGENT_STOPPED = 78;

const STATUS_PROTOCOL = `
# Estado de la etapa (obligatorio)

You run unattended inside a GitHub Actions pipeline. The workflow decides whether the stage moves on from ONE line, which must be the LAST line of your final answer, exactly one of:

ESTADO: COMPLETADO
ESTADO: PREGUNTA
ESTADO: BLOQUEADO

- COMPLETADO: you did everything the stage asked (files written, commits made, labels changed when asked). Reporting a negative outcome that the stage asks you to report (a failed test plan, a review asking for changes, questions addressed to the architect or the analyst in the next step) is still COMPLETADO.
- PREGUNTA: you cannot go on without a decision of a PERSON (the product owner). Your answer must contain the numbered questions, each with a default proposal.
- BLOQUEADO: you could not finish the stage: a tool or permission was denied, a command kept failing, specs/ or the plan is contradictory, or anything else left the work incomplete. Explain what is missing and how to unblock it.

When in doubt between COMPLETADO and BLOQUEADO, answer BLOQUEADO: the next stage starts automatically from COMPLETADO, and it must never start from incomplete work. Do not try to work around a denied tool by other means. Do not put anything after the status line.
`.trim();

const STATES = ["COMPLETADO", "PREGUNTA", "BLOQUEADO"];
const stateFile = path.join(process.env.RUNNER_TEMP || os.tmpdir(), "agent-state");
const stoppedFile = path.join(process.env.RUNNER_TEMP || os.tmpdir(), "agent-stopped.md");

// Finds the last "ESTADO: X" line (tolerating Markdown emphasis or code
// around it) and returns the state and the answer without that line.
function extractState(text) {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].replace(/[*_`>]/g, "").trim().match(/^ESTADO:\s*([A-ZÁÉÍÓÚ]+)\s*$/i);
    if (m && STATES.includes(m[1].toUpperCase())) {
      lines.splice(i, 1);
      return { state: m[1].toUpperCase(), body: lines.join("\n").trimEnd() };
    }
  }
  return { state: null, body: text.trimEnd() };
}

// Short description of a denied tool call, without file contents.
function describeDenial(d) {
  const input = d?.tool_input ?? {};
  const detail = input.command ?? input.file_path ?? input.path ?? input.pattern ?? "";
  const oneLine = String(detail).replace(/\s+/g, " ").trim();
  return `${d?.tool_name ?? "?"}${oneLine ? `: ${oneLine.length > 200 ? `${oneLine.slice(0, 200)}…` : oneLine}` : ""}`;
}

const [answerFile, ...claudeArgs] = process.argv.slice(2);
if (!answerFile || claudeArgs.length === 0) {
  console.error("Usage: node run-agent.mjs <answer-file> <claude args...>");
  process.exit(2);
}

const percent = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : fallback;
};
const thresholds = {
  five_hour: percent(process.env.AGENT_MAX_FIVE_HOUR_PCT, 90),
  seven_day: percent(process.env.AGENT_MAX_SEVEN_DAY_PCT, 90),
};
const windowNames = { five_hour: "ventana de 5 horas", seven_day: "semana" };
const marker = path.join(process.env.RUNNER_TEMP || os.tmpdir(), "usage-limit.md");

// Self-hosted runners keep /tmp between runs: never leave an older answer
// in place if this run ends without one.
fs.writeFileSync(answerFile, "");

let stopped = null; // { window, used, resetsAt, rejected }
let answer = "";
let answerIsError = false;
const lastWindows = {};

// The agents read conversations only through issue-thread.mjs, which drops
// comments from untrusted authors (the repository is public). Deny rules
// win over allow rules and also apply to nested commands, so these block
// every other way of reading comments or reviews with gh.
const DENIED_TOOLS = [
  "Bash(gh issue view *comments*)",
  "Bash(gh issue view *-c*)",
  "Bash(gh issue list *comments*)",
  "Bash(gh pr view *comments*)",
  "Bash(gh pr view *-c*)",
  "Bash(gh pr view *reviews*)",
  "Bash(gh pr list *comments*)",
  "Bash(gh api *)",
  "Bash(gh search *)",
];

let denials = [];

const child = spawn("claude", [...claudeArgs, "--append-system-prompt", STATUS_PROTOCOL, "--disallowedTools", ...DENIED_TOOLS, "--output-format", "stream-json", "--verbose"], {
  stdio: ["ignore", "pipe", "inherit"],
});

function stop(reason) {
  if (stopped) return;
  stopped = reason;
  console.error(
    `[run-agent] Stopping: ${reason.window} usage ${Math.round(reason.used * 100)}%` +
      (reason.rejected ? " (rejected by the subscription)" : ` >= ${thresholds[reason.window]}%`),
  );
  child.kill("SIGINT");
  setTimeout(() => child.kill("SIGKILL"), 20_000).unref();
}

function checkUsage(info) {
  const windows = info?.unifiedWindows ?? {};
  for (const [name, w] of Object.entries(windows)) {
    if (!w || typeof w.utilization !== "number") continue;
    lastWindows[name] = w;
    const limit = thresholds[name];
    const rejected = w.status === "rejected";
    if (rejected || (limit !== undefined && w.utilization * 100 >= limit)) {
      stop({ window: name, used: w.utilization, resetsAt: w.resetsAt, rejected });
      return;
    }
  }
  if (info?.status === "rejected" && info.rateLimitType) {
    stop({ window: info.rateLimitType, used: 1, resetsAt: info.resetsAt, rejected: true });
  }
}

readline.createInterface({ input: child.stdout }).on("line", (line) => {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }
  if (event.type === "rate_limit_event") {
    const w = event.rate_limit_info?.unifiedWindows ?? {};
    const shown = Object.entries(w)
      .map(([name, v]) => `${name} ${Math.round((v?.utilization ?? 0) * 100)}%`)
      .join(", ");
    console.error(`[run-agent] Subscription usage: ${shown}`);
    checkUsage(event.rate_limit_info);
  } else if (event.type === "result") {
    answer = typeof event.result === "string" ? event.result : "";
    answerIsError = Boolean(event.is_error);
    denials = Array.isArray(event.permission_denials) ? event.permission_denials : [];
    for (const d of denials) console.error(`[run-agent] Permission denied: ${describeDenial(d)}`);
  }
});

function formatReset(epochSeconds) {
  if (!epochSeconds) return "en cuanto se renueve";
  return new Date(epochSeconds * 1000).toLocaleString("es-ES", {
    timeZone: process.env.AGENT_TIME_ZONE || "Europe/Madrid",
    dateStyle: "full",
    timeStyle: "short",
  }) + ` (${process.env.AGENT_TIME_ZONE || "Europe/Madrid"})`;
}

child.on("close", (code) => {
  // A request rejected before any usage event: the CLI ends with an error
  // answer and the last known window is the one that ran out.
  if (!stopped && answerIsError && /limit/i.test(answer)) {
    const [name, w] = Object.entries(lastWindows).sort((a, b) => b[1].utilization - a[1].utilization)[0] ?? [];
    stopped = { window: name ?? "five_hour", used: w?.utilization ?? 1, resetsAt: w?.resetsAt, rejected: true };
  }

  if (stopped) {
    const name = windowNames[stopped.window] ?? stopped.window;
    const note = [
      "⏸️ **Etapa detenida para no agotar la suscripción de Claude.**",
      "",
      stopped.rejected
        ? `Se ha alcanzado el límite de uso de la ${name}.`
        : `El uso de la ${name} ha llegado al ${Math.round(stopped.used * 100)} % (el pipeline se detiene al ${thresholds[stopped.window]} %).`,
      `Se renueva: ${formatReset(stopped.resetsAt)}.`,
      "",
      "- Lo hecho hasta ahora se conserva: los commits pendientes se suben a la rama del issue.",
      "- La etiqueta del issue no cambia y no se pasa a la siguiente etapa.",
      "- Para continuar cuando se renueve el uso, escribe un comentario en el issue (se repite la etapa de la etiqueta actual) o relánzala desde la pestaña Actions.",
      "",
      `Log de la ejecución: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      "",
    ].join("\n");
    fs.writeFileSync(answerFile, note);
    fs.writeFileSync(marker, note);
    process.exit(EXIT_USAGE_LIMIT);
  }

  if (code !== 0 || answerIsError) {
    fs.writeFileSync(answerFile, answer);
    process.exit(1);
  }

  const { state, body } = extractState(answer);
  console.error(`[run-agent] Agent status: ${state ?? "(missing, treated as BLOQUEADO)"}`);
  if (state === "COMPLETADO") {
    fs.writeFileSync(answerFile, body);
    process.exit(0);
  }

  const finalState = state === "PREGUNTA" ? "PREGUNTA" : "BLOQUEADO";
  const header =
    finalState === "PREGUNTA"
      ? [
          "❓ **Etapa detenida: el agente necesita una decisión.**",
          "",
          "El issue queda en `needs-info` y no pasa a la siguiente etapa. Responde a las preguntas con un comentario en el issue y la etapa se repetirá.",
        ]
      : [
          "⛔ **Etapa detenida: el agente no ha podido terminarla.**",
          "",
          state === null
            ? "El agente no ha indicado su estado (línea `ESTADO:`), así que se trata como bloqueado."
            : "El agente ha indicado `ESTADO: BLOQUEADO`.",
          "El issue queda en `human-review` y no pasa a la siguiente etapa. Cuando esté resuelto, quita `human-review` y escribe un comentario en el issue para repetir la etapa.",
        ];
  const denied = denials.length
    ? ["", "<details><summary>Herramientas denegadas</summary>", "", ...denials.map((d) => `- \`${describeDenial(d).replace(/`/g, "'")}\``), "", "</details>"]
    : [];
  const note = [
    ...header,
    "",
    `Log de la ejecución: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    ...denied,
    "",
    "---",
    "",
    body || "_(sin respuesta del agente)_",
    "",
  ].join("\n");
  fs.writeFileSync(answerFile, note);
  fs.writeFileSync(stoppedFile, note);
  fs.writeFileSync(stateFile, finalState);
  process.exit(EXIT_AGENT_STOPPED);
});
