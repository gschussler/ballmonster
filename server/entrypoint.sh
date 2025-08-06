#!/bin/sh
# create named pipe (defensive removal in case of container rebuild oddities)
rm -f /tmp/access.pipe
mkfifo /tmp/access.pipe

# start anonymizer in background
/usr/local/bin/anonymize &

# start nginx in foreground
nginx -g "daemon off;"