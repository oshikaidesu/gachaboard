FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install

COPY *.ts ./

EXPOSE 5858

CMD ["npm", "start"]
