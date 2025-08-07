#!/bin/bash
echo "Starting daily logrotate runner..."
while true; do
  echo "[logrotate] Running at $(date)"
  /usr/sbin/logrotate /etc/logrotate.d/goaccess
  sleep 86400
done