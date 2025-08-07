#!/bin/bash
set -eu

LOGFILE="/data/logs/goaccess.log"
OUTFILE="/data/html/report.html"
DBDIR="/data/goaccess-db"

mkdir -p "$(dirname "$OUTFILE")"
mkdir -p "$DBDIR"

if [ ! -f "$LOGFILE" ]; then
    echo "Log file not found: $LOGFILE"
    exit 0  # don't fail if no logs yet
fi

echo "Running GoAccess on $LOGFILE with persistent DB..."

goaccess \
  --config-file=/etc/goaccess/goaccess.conf \
  --restore \
  --persist \
  --db-path="$DBDIR" \
  --output="$OUTFILE" \
  "$LOGFILE"

echo "GoAccess report updated at $OUTFILE"