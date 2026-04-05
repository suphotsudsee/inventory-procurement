# Development stage
FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --include=optional

# Copy application code
COPY . .

# For production: build and serve with nginx
# For development: run vite dev server

# Expose port
EXPOSE 5173

# Start vite dev server (default for development)
CMD ["npm", "run", "dev"]