# Production Dockerfile for Gemini Bot (Nuxt 3 + Playwright)
FROM mcr.microsoft.com/playwright:v1.45.0-noble

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Build production Nitro bundle
RUN npm run build

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Start production server
CMD ["node", ".output/server/index.mjs"]
