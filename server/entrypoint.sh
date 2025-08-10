#!/bin/sh
set -e
# create named pipe (defensive removal in case of container rebuild oddities)
rm -f /tmp/access.pipe
mkfifo /tmp/access.pipe
echo "[entrypoint] Named pipe created at /tmp/access.pipe"

# start pseudonymizer in background
/pseudonymize &
echo "[entrypoint] 'pseudonymize' started"

# start logrotate loop in background
/usr/local/bin/run-logrotate.sh &
echo "[entrypoint] logrotate loop started"

# brief buffer for pseudonymize attachment to pipe
sleep 1

# start nginx in foreground
nginx -g "daemon off;"