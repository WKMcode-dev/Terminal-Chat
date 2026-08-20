FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/protocol/package.json backend/protocol/package.json
COPY backend/server/package.json backend/server/package.json
COPY frontend/desktop/package.json frontend/desktop/package.json

RUN npm ci --workspace=@terminal-chat/protocol --workspace=@terminal-chat/server

COPY backend/protocol backend/protocol
COPY backend/server backend/server

RUN npm run build --workspace=@terminal-chat/protocol \
  && npm run build --workspace=@terminal-chat/server

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/protocol/package.json backend/protocol/package.json
COPY backend/server/package.json backend/server/package.json
COPY frontend/desktop/package.json frontend/desktop/package.json

RUN npm ci --omit=dev --workspace=@terminal-chat/protocol --workspace=@terminal-chat/server \
  && npm cache clean --force

COPY --from=build /app/backend/protocol/dist backend/protocol/dist
COPY --from=build /app/backend/server/dist backend/server/dist

RUN mkdir -p /app/.terminal-chat && chown -R node:node /app/.terminal-chat

USER node

EXPOSE 3000

CMD ["node", "backend/server/dist/main.js"]
