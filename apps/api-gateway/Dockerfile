FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate || true
RUN npx nest build api-gateway

# Keep only runtime dependencies for the final image.
RUN npm prune --omit=dev && npm cache clean --force

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/api-gateway ./dist

EXPOSE 3003

CMD ["node", "dist/main.js"]
