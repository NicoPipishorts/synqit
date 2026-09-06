FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/i18n/package.json packages/i18n/package.json
RUN yarn install --frozen-lockfile || yarn install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn workspace @synqit/shared build && yarn workspace @synqit/worker build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY package.json package.json
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "apps/worker/dist/index.js"]
