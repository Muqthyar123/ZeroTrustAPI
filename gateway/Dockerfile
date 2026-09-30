FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Copy configuration and source files
COPY server.js ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Expose Gateway port
EXPOSE 8080

# Environment defaults
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    SAMPLE_APP_URL=http://sample-app:3000 \
    REDIS_URL=redis://redis:6379 \
    EVENTS_SERVICE_URL=http://events:5000/v1/events \
    JWT_SECRET=development-secret

# Run Gateway
CMD ["npm", "start"]
