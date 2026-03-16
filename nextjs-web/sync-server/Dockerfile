FROM node:22-alpine

WORKDIR /app

COPY sync-server/package*.json sync-server/
COPY sync-server/gate.mjs sync-server/

WORKDIR /app/sync-server
RUN npm install

RUN mkdir -p /app/sync-data

EXPOSE 5858

ENV PORT=5858
ENV HOST=0.0.0.0

CMD ["node", "gate.mjs"]
