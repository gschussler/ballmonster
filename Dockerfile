FROM node:18-alpine AS builder
WORKDIR /app

COPY . .
RUN npm install && npm run build

FROM caddy:alpine
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile