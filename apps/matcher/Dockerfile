FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate || true
RUN npx nest build matcher

# Keep only runtime dependencies for the final image.
RUN npm prune --omit=dev && npm cache clean --force

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/matcher ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]
