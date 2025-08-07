#!/bin/sh

set -e  # exit on error
set -x  # print commands

echo "[entrypoint] Environment Variables:"
env

# render NGINX config
echo "[entrypoint] Rendering NGINX config..."
envsubst '${NGINX_PORT} ${WS_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# render GoAccess config
echo "[entrypoint] Rendering GoAccess config..."
envsubst '${WS_URL}' < /etc/goaccess/goaccess.conf.template > /etc/goaccess/goaccess.conf

# rreate necessary directories
mkdir -p /data/html /data/logs
chmod -R 755 /data/html

# start logrotate runner in background
echo "[entrypoint] Starting daily logrotate runner..."
/usr/local/bin/run-logrotate.sh &

# start NGINX in foreground
echo "[entrypoint] Starting NGINX..."
nginx -g "daemon off;"