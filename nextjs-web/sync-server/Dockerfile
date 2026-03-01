FROM node:22-alpine

RUN apk add --no-cache python3 make g++

# build context は nextjs-web/ なので sync-server/ と shared/ の両方が参照可能
WORKDIR /app

COPY sync-server/package.json ./
RUN npm install

COPY sync-server/*.ts ./

# shared/ ディレクトリ（shapeDefs.ts など）をコピー
COPY shared ./shared

EXPOSE 5858

CMD ["npm", "start"]
