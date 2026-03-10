FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY apps/site/package.json apps/site/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN yarn install --frozen-lockfile || yarn install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn workspace @synqit/site build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN yarn global add serve
COPY --from=build /app/apps/site/dist ./dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
