FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/storage /app/output

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
