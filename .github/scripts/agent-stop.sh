#!/bin/sh
# Handles a stage stopped by its agent (see run-agent.mjs, exit code 78):
# labels the issue `needs-info` (ESTADO: PREGUNTA) or `human-review`
# (ESTADO: BLOQUEADO or no status line) and, with --comment, posts the
# agent's answer with the stop note. The stage label is kept, so nothing
# moves on until a person answers or reviews it.
#
# Usage: sh agent-stop.sh [--comment]
# Needs GH_TOKEN, ISSUE_NUMBER and RUNNER_TEMP. Does nothing if no agent
# stopped in this job.
set -eu

STATE_FILE="$RUNNER_TEMP/agent-state"
[ -f "$STATE_FILE" ] || exit 0
STATE=$(cat "$STATE_FILE")

if [ "${1:-}" = "--comment" ]; then
  gh issue comment "$ISSUE_NUMBER" --body-file "$RUNNER_TEMP/agent-stopped.md"
fi

if [ "$STATE" = "PREGUNTA" ]; then
  gh label create needs-info --color fbca04 --description "Bloqueado por una pregunta" 2>/dev/null || true
  gh issue edit "$ISSUE_NUMBER" --add-label needs-info
else
  gh label create human-review --color d93f0b --description "Necesita revisión de una persona" 2>/dev/null || true
  gh issue edit "$ISSUE_NUMBER" --add-label human-review
fi
echo "Stage stopped by the agent ($STATE); the issue does not move on."
