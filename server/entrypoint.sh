#!/bin/sh
# create named pipe (defensive removal in case of container rebuild oddities)
rm -f /tmp/access.pipe
mkfifo /tmp/access.pipe

echo "[entrypoint] Named pipe created at /tmp/access.pipe"

# start anonymizer in background
/anonymize &
echo "[entrypoint] Anonymizer started"

# brief buffer for anonymize attachment to pipe
sleep 1

# start nginx in foreground
nginx -g "daemon off;"