# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init

# Create non-root user
USER node

# Copy dependencies and build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Copy contract schemas as they are runtime dependency if loaded from disk
COPY --from=builder /app/src/contracts/schemas ./contracts

ENV NODE_ENV=production
ENV PORT=8093

EXPOSE 8093

CMD ["dumb-init", "node", "dist/index.js"]
