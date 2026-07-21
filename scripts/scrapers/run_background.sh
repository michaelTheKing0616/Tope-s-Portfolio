#!/usr/bin/env bash
# Run the open-football harvester in the background from your local terminal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/sportverse/data/raw/open-football/logs"
PID_FILE="$ROOT/sportverse/data/raw/open-football/harvest.pid"
mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Harvest already running (PID $OLD_PID)."
    echo "  tail -f $LOG_DIR/harvest.log"
    exit 0
  fi
fi

python3 -m pip install -r scripts/scrapers/requirements.txt --quiet

nohup python3 scripts/scrapers/harvest_open_football_data.py \
  --sources "${1:-statsbomb,fbref}" \
  > "$LOG_DIR/harvest.out" 2>&1 &

echo $! > "$PID_FILE"
echo "Started open-football harvest in background (PID $(cat "$PID_FILE"))."
echo "  tail -f $LOG_DIR/harvest.log"
echo "  tail -f $LOG_DIR/harvest.out"
echo "  kill \$(cat $PID_FILE)   # stop"
