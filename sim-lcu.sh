#!/usr/bin/env bash
# A simulated League client for the desktop app, in the browser — nothing compiled.
#
# Opens two tabs on the desktop app's dev server: the draft simulator
# (/dev/draft-sim), which plays the client in champion select, and the app's
# draft screen, which follows it live over a broadcast channel. Starts the dev
# server first when none is running, and stops it on Ctrl+C.
# The app's own writes to the client (Hover, Ban, Lock in) need the shell:
# `cd desktop/app && npm run tauri:sim` for those.
set -euo pipefail
cd "$(dirname "$0")/desktop/app"

# A desktop dev server is one that answers the simulator's relay.
running_on() { curl -sf -o /dev/null "http://localhost:$1/__sim/lcu?generation=0&after=0"; }

PORT=""
for candidate in 3000 3003; do
  if running_on "$candidate"; then PORT=$candidate; break; fi
done

DEV=""
if [ -z "$PORT" ]; then
  PORT=3003
  [ -d node_modules ] || npm install
  echo "Starting the dev server on :$PORT (log: /tmp/truemain-sim-dev.log)…"
  npm run dev > /tmp/truemain-sim-dev.log 2>&1 &
  DEV=$!
  trap 'kill "$DEV" 2>/dev/null' EXIT INT TERM
  until running_on "$PORT"; do
    kill -0 "$DEV" 2>/dev/null || { echo "The dev server stopped; see /tmp/truemain-sim-dev.log"; exit 1; }
    sleep 1
  done
fi

open_url() { if command -v open >/dev/null; then open "$1"; else xdg-open "$1" >/dev/null 2>&1 & fi; }
open_url "http://localhost:$PORT/#/dev/draft-sim?start"
sleep 1
open_url "http://localhost:$PORT/#/draft"
echo "Simulated client in champion select: http://localhost:$PORT/#/dev/draft-sim — click its slots to pick and ban; the app follows in the other tab."

if [ -n "$DEV" ]; then
  echo "Ctrl+C stops the dev server."
  wait "$DEV"
fi
