FROM node:22-alpine

WORKDIR /app

COPY sync-server/package*.json sync-server/

WORKDIR /app/sync-server
RUN npm install

EXPOSE 5858

ENV PORT=5858
ENV HOST=0.0.0.0

CMD ["sh", "-c", "PORT=5858 HOST=0.0.0.0 npx y-websocket-server"]
