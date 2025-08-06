#!/bin/sh

# substitute environment variables into the output config files
envsubst '${NGINX_PORT} ${WS_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
envsubst '${WS_URL}' < /etc/goaccess/goaccess.conf.template > /etc/goaccess/goaccess.conf

# make script executable (might not work if Coolify has bind mount restrictions)
chmod +x "$0"

# create named pipe with the same label as project repo resource
rm -f /tmp/access.pipe
mkfifo /tmp/access.pipe

# start GoAccess in the background
goaccess /tmp/access.pipe \
  --log-format=COMBINED \
  --output=/data/html/index.html \
  --real-time-html \
  --daemonize \
  --config-file=/etc/goaccess/goaccess.conf

# start NGINX in the foreground
nginx -g "daemon off;"