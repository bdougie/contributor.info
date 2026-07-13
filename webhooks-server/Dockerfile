# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy root package files for shared dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Copy webhooks-server (package files, tsconfig, and its own source)
COPY webhooks-server/package*.json ./webhooks-server/
COPY webhooks-server/tsconfig.json ./webhooks-server/
COPY webhooks-server/src/ ./webhooks-server/src/

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
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY webhooks-server/package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built files from builder (includes compiled app/ and src/ modules)
COPY --from=builder /app/webhooks-server/dist ./dist

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start server
# esbuild bundles the whole graph into a single dist/server.js
CMD ["node", "dist/server.js"]
