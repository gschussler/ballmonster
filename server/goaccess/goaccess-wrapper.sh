#!/bin/bash
set -eu

LOGFILE="/data/logs/goaccess.log"
OUTFILE="/data/html/index.html"

mkdir -p "$(dirname "$OUTFILE")"

if [ ! -f "$LOGFILE" ]; then
    echo "Log file not found: $LOGFILE"
    exit 0  # don't fail if no logs yet
fi

echo "Running GoAccess on $LOGFILE..."

goaccess \
  --log-format=COMBINED \
  --anonymize-ip \
  --output="$OUTFILE" \
  "$LOGFILE"

echo "GoAccess report updated at $OUTFILE"