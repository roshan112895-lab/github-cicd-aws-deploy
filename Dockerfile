# Copy package files first for better layer caching
FROM node:20-alpine AS base

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY . .

# Ensure data directory exists and is writable at runtime
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=3002
ENV DATA_FILE=/app/data/tasks.json

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/health || exit 1

CMD ["node", "src/server.js"]
