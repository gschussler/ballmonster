#!/bin/sh

set -e  # exit on error
set -x  # print commands

# print all env vars
echo "[entrypoint] Environment Variables:"
env

# make sure templates are rendered
echo "[entrypoint] Rendering NGINX config..."
envsubst < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

echo "[entrypoint] Rendering GoAccess config..."
envsubst < /etc/goaccess/goaccess.conf.template > /etc/goaccess/goaccess.conf

# debug output: show rendered configs
echo "[entrypoint] Rendered NGINX config:"
cat /etc/nginx/conf.d/default.conf

echo "[entrypoint] Rendered GoAccess config:"
cat /etc/goaccess/goaccess.conf

# prepare named pipe
PIPE=/tmp/access.pipe
echo "[entrypoint] Creating named pipe at $PIPE..."
rm -f "$PIPE"
mkfifo "$PIPE"
chmod 666 "$PIPE"

# ensure output directory exists
mkdir -p /data/html
chmod -R 755 /data/html

# start GoAccess
echo "[entrypoint] Starting GoAccess..."
goaccess "$PIPE" \
  --log-format=COMBINED \
  --output=/data/html/index.html \
  --real-time-html \
  --daemonize \
  --config-file=/etc/goaccess/goaccess.conf

# ensure GoAccess is writing
echo "[entrypoint] Waiting for GoAccess output..."
sleep 2
if [ -f /data/html/index.html ]; then
  echo "[entrypoint] GoAccess generated /data/html/index.html"
else
  echo "[entrypoint] GoAccess has not yet written to /data/html/index.html"
fi

echo "[entrypoint] Starting NGINX..."
nginx -g "daemon off;"