FROM node:17.9.1-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build (if needed)
RUN npm run build || true

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
