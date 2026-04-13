# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy configuration files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the NestJS app (outputs to /dist)
RUN npx nest build optimizer

# Stage 2: Production environment
FROM node:20-alpine

WORKDIR /app

# Copy the build output and package files from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist/apps/optimizer ./dist

# Install ONLY production dependencies to keep the image light
RUN npm install --only=production

# Expose the container port
EXPOSE 3000

CMD ["node", "dist/main.js"]