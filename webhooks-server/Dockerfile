# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for shared dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Copy webhooks-server
COPY webhooks-server/package*.json ./webhooks-server/
COPY webhooks-server/tsconfig.json ./webhooks-server/

# Copy app/ directory (contains our consolidated webhook handlers)
COPY app/ ./app/

# Copy src/ directory (contains types and lib)
COPY src/ ./src/

# Install dependencies for webhooks-server
WORKDIR /app/webhooks-server
RUN npm ci --production=false

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY webhooks-server/package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built files from builder
COPY --from=builder /app/webhooks-server/dist ./dist

# Copy app/ directory (runtime dependency)
COPY app/ ./app/

# Copy src/ directory (runtime dependency)
COPY src/ ./src/

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "dist/server.js"]
