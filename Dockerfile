# Keep every stage on the October 2026 security release or newer.
ARG NODE_VERSION=24.22.1

# Build stage for client
FROM node:${NODE_VERSION}-alpine AS client-builder
WORKDIR /app/client

# Accept build args for environment variables
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DEV_MODE

# Set as environment variables for the build
ENV VITE_DISCORD_CLIENT_ID=${VITE_DISCORD_CLIENT_ID}
ENV VITE_DEV_MODE=${VITE_DEV_MODE}

COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage for server
FROM node:${NODE_VERSION}-alpine AS server
WORKDIR /app

COPY scripts/check-node-security.cjs /usr/local/lib/check-node-security.cjs
RUN node /usr/local/lib/check-node-security.cjs

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server code
COPY server/ ./server/

# Copy built client files
COPY --from=client-builder /app/client/dist ./client/dist

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server/server.js"]

# Production stage for bot
FROM node:${NODE_VERSION}-alpine AS bot
WORKDIR /app

COPY scripts/check-node-security.cjs /usr/local/lib/check-node-security.cjs
RUN node /usr/local/lib/check-node-security.cjs

# Install build dependencies for canvas and fonts
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    ttf-liberation \
    fontconfig

# Install bot dependencies
COPY bot/package*.json ./bot/
RUN cd bot && npm ci --omit=dev

# Copy bot code
COPY bot/ ./bot/

# Start the bot
WORKDIR /app/bot
CMD ["node", "bot.js"]
