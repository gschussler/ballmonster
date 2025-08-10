FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN adduser --system --no-create-home --group nginx

RUN apt-get update && apt-get install -y \
    gnupg \
    wget \
    curl \
    ca-certificates \
    lsb-release \
    nginx \
    bash \
    gettext \
    && wget -O - https://deb.goaccess.io/gnugpg.key | gpg --dearmor > /usr/share/keyrings/goaccess.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/goaccess.gpg arch=$(dpkg --print-architecture)] https://deb.goaccess.io/ $(lsb_release -cs) main" > /etc/apt/sources.list.d/goaccess.list \
    && apt-get update && apt-get install -y goaccess \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# create nginx user and directories
RUN adduser --system --no-create-home --group nginx \
    && mkdir -p /data/html /tmp /var/log/nginx /run/nginx \
    && chown -R nginx:nginx /var/log/nginx /run/nginx /data/html

COPY entrypoint-g.sh /entrypoint.sh
COPY nginx-g.conf /etc/nginx/nginx.conf
COPY default-g.conf.template /etc/nginx/conf.d/default.conf.template
COPY goaccess.conf /etc/goaccess/goaccess.conf

COPY goaccess-wrapper.sh /usr/local/bin/goaccess-wrapper.sh
COPY run-goaccess-loop.sh /usr/local/bin/run-goaccess-loop.sh

RUN chmod +x /entrypoint.sh /usr/local/bin/goaccess-wrapper.sh /usr/local/bin/run-goaccess-loop.sh 

EXPOSE 8084

ENTRYPOINT ["/entrypoint.sh"]