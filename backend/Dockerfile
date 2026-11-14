# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,id=wms-backend-npm,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4002

COPY package*.json ./
RUN --mount=type=cache,id=wms-backend-npm,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --prefer-offline

COPY --from=build /app/dist ./dist

USER node

EXPOSE 4002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4002) + '/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]