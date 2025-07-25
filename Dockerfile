FROM node:24-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN node esbuild.config.js

FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]