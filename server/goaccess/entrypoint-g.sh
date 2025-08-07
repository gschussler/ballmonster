#!/bin/sh

set -e  # exit on error
set -x  # print commands

echo "[entrypoint] Environment Variables:"
env

# render NGINX config
echo "[entrypoint] Rendering NGINX config..."
envsubst '${NGINX_PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# create necessary directories and grant write permissions for html & db
mkdir -p /data/html /data/logs /data/goaccess-db
chmod -R 755 /data/html /data/goaccess-db

# start logrotate runner in background
echo "[entrypoint] Starting daily logrotate runner..."
/usr/local/bin/run-logrotate.sh &

# start GoAccess update loop in background
echo "[entrypoint] Starting GoAccess update loop..."
/usr/local/bin/run-goaccess-loop.sh &

# start NGINX in foreground
echo "[entrypoint] Starting NGINX..."
nginx -g "daemon off;"