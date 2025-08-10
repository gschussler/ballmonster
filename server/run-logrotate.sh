#!/bin/sh
echo "[logrotate-runner] Started loop (PID $$)..."
while true; do
  echo "[logrotate] Running at $(date)"
  /usr/sbin/logrotate /etc/logrotate.d/goaccess
  sleep 24h
done