FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Copy configuration and source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose Events Service port
EXPOSE 5000

# Environment defaults
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0 \
    MOCK_DATA=false

# Run Events Service
CMD ["npm", "start"]
