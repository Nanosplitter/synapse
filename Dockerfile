# Build stage for client
FROM node:18-alpine AS client-builder
WORKDIR /app/client

# Accept build args for environment variables
ARG VITE_DISCORD_CLIENT_ID
ARG DISCORD_CLIENT_SECRET
ARG VITE_DEV_MODE

# Set as environment variables for the build
ENV VITE_DISCORD_CLIENT_ID=${VITE_DISCORD_CLIENT_ID}
ENV VITE_DEV_MODE=${VITE_DEV_MODE}

COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage for server
FROM node:18-alpine AS server
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Copy server code
COPY server/ ./server/

# Copy built client files
COPY --from=client-builder /app/client/dist ./client/dist

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server/server.js"]

# Production stage for bot
FROM node:18-alpine AS bot
WORKDIR /app

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
RUN cd bot && npm ci --production

# Copy bot code
COPY bot/ ./bot/

# Start the bot
WORKDIR /app/bot
CMD ["node", "bot.js"]