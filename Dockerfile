FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY . .

EXPOSE 3000

ENV PORT=3000
ENV LOG_DIR=/app/logs
RUN mkdir -p /app/logs
CMD ["node", "src/server.js"]
