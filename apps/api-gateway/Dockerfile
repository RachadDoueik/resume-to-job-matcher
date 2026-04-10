# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy configuration files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code including prisma schema if applicable
COPY . .

# Generate prisma client (if used by api-gateway)
RUN npx prisma generate || true

# Build the NestJS app
RUN npx nest build api-gateway

# Stage 2: Production environment
FROM node:20-alpine

WORKDIR /app

# Copy the package files
COPY --from=builder /app/package*.json ./

# Install ONLY production dependencies to keep the image light
RUN npm install --omit=dev

# Copy generated Prisma client from builder (if exist)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy the built output from the builder stage
COPY --from=builder /app/dist/apps/api-gateway ./dist

# Expose the API gateway port
EXPOSE 3000

CMD ["node", "dist/main.js"]
