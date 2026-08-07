# Stage 1: Build the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source files (including .env for Vite build variables)
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy backend files, built frontend, shared src utilities, and tsconfig
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/utils ./src/utils
COPY --from=builder /app/tsconfig*.json ./

# Create directory for SQLite database volume
RUN mkdir -p /app/data

# Expose the application port
EXPOSE 8082

# Start the application
CMD ["npx", "tsx", "server/index.ts"]
