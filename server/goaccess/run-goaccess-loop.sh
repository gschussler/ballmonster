#!/bin/bash
echo "[goaccess-loop] Starting GoAccess update loop (PID $$)..."
while true; do
  echo "[goaccess-loop] Running update at $(date)"
  /usr/local/bin/goaccess-wrapper.sh
  sleep 1800
done