FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Copy configuration and source files
COPY tsconfig.json ./
COPY src/ ./src/

# Expose Sample App port
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    OWNERSHIP_BASE_URL=http://ownership:4000 \
    JWT_SECRET=development-secret \
    APP_MODE=vulnerable

# Run Sample App
CMD ["npm", "start"]
