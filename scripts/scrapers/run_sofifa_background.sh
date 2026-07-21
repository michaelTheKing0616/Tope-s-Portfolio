#!/usr/bin/env bash
# Bulk live SoFIFA harvest in the background (retired legends / missing from FC26 CSV).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/sportverse/data/raw/open-football/logs"
PID_FILE="$ROOT/sportverse/data/raw/open-football/sofifa-live.pid"
mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "SoFIFA live bulk already running (PID $OLD_PID)."
    echo "  tail -f $LOG_DIR/sofifa-live-bulk.log"
    exit 0
  fi
fi

python3 -m pip install -r scripts/scrapers/requirements.txt --quiet

# Visible browser is more reliable against Cloudflare — run from a logged-in desktop session.
nohup python3 scripts/scrapers/sofifa_live_bulk.py \
  --target "${1:-legends-missing}" \
  --no-headless \
  > "$LOG_DIR/sofifa-live-bulk.out" 2>&1 &

echo $! > "$PID_FILE"
echo "Started SoFIFA live bulk harvest (PID $(cat "$PID_FILE"))."
echo "  tail -f $LOG_DIR/sofifa-live-bulk.log"
echo "  tail -f $LOG_DIR/sofifa-live-bulk.out"
echo "  kill \$(cat $PID_FILE)   # stop"
echo ""
echo "  A Chrome window will open — complete any Cloudflare check if prompted."
echo "  Re-run this script to resume after interruption (checkpoint saved)."
