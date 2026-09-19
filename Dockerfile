# Stage 1: Build Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install server dependencies
COPY server/package*.json ./server/
RUN npm --prefix server install --omit=dev

# Copy application source
COPY server/ ./server/
COPY --from=frontend-builder /app/client/dist ./client/dist
COPY package.json ./

EXPOSE 3030
CMD ["node", "server/index.js"]
