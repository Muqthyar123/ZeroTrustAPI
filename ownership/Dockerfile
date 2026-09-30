FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Copy configuration and source files
COPY tsconfig.json ./
COPY src/ ./src/

# Expose Ownership Service port
EXPOSE 4000

# Environment defaults
ENV NODE_ENV=production \
    OWNERSHIP_PORT=4000 \
    HOST=0.0.0.0 \
    REDIS_URL=redis://redis:6379 \
    JWT_SECRET=development-secret

# Run Ownership Service
CMD ["npm", "start"]
