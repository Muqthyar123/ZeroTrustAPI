FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Copy source and config files
COPY . .

# Expose Dashboard port
EXPOSE 5173

# Environment defaults
ENV NODE_ENV=development \
    VITE_API_URL=http://localhost:5000

# Run Dashboard via vite
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
