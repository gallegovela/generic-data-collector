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
// Exit codes:
//   0  the agent finished; its final answer is in <answer-file>
//   1  the agent failed for any other reason
//   75 stopped by the usage limit; <answer-file> and
//      $RUNNER_TEMP/usage-limit.md hold a note (in Spanish) for the issue
//      with the usage and the time it resets. Later steps check that file
//      so the issue keeps its label and nothing moves on.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const EXIT_USAGE_LIMIT = 75;

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

const child = spawn("claude", [...claudeArgs, "--output-format", "stream-json", "--verbose"], {
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

  fs.writeFileSync(answerFile, answer);
  process.exit(code === 0 && !answerIsError ? 0 : 1);
});
