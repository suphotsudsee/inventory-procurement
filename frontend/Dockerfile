# Build stage
FROM node:20-bookworm-slim as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Tailwind v4/PostCSS relies on optional native bindings (@tailwindcss/oxide-*).
# npm can skip those packages in container builds, so install the matching Linux binding explicitly.
RUN npm ci --include=optional \
    && ARCH="$(node -p "process.arch")" \
    && if [ "$ARCH" = "x64" ]; then npm install --no-save @tailwindcss/oxide-linux-x64-gnu@4.2.2; \
    elif [ "$ARCH" = "arm64" ]; then npm install --no-save @tailwindcss/oxide-linux-arm64-gnu@4.2.2; \
    else echo "Unsupported architecture for explicit Tailwind oxide install: $ARCH" && exit 1; \
    fi

# Copy application code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
