
# STAGE 1: build Node static site
FROM node:lts-slim AS site-builder

WORKDIR /app

# install deps and build
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# STAGE 2 (not ready yet): build Go anonymizer
# FROM golang:alpine AS go-builder

# WORKDIR /app

# COPY anonymize.go .

# RUN go build -o anonymize ./anonymize.go

# STAGE 3: final image with NGINX + anonymizer
FROM nginx:alpine

# set working directory (nginx default)
WORKDIR /usr/share/nginx/html

# copy built static site from site-builder
COPY --from=site-builder /app/dist/ .

# Not ready yet: copy the Go binary
# COPY --from=go-builder /app/anonymizer /app/anonymizer

# custom NGINX config
COPY nginx/nginx.conf /etc/nginx/nginx.conf
# COPY nginx/mime.types /etc/nginx/mime.types
# COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Not ready yet: Copy entrypoint script to set up access log piping
# COPY entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh
# ENTRYPOINT ["/entrypoint.sh"]

# use default nginx foreground behavior
CMD ["nginx", "-g", "daemon off;"]