FROM node:20-slim AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

VOLUME ["/app/data"]
ENV DB_PATH=/app/data/orders.db

EXPOSE 3000

CMD ["node", "consumer.js"]
