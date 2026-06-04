# Build and Runtime Image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build and tsx)
RUN npm ci

# Copy the entire project
COPY . .

# Build the frontend (outputs to /dist)
RUN npm run build

# Expose port 8082
EXPOSE 8082

# Set the port environment variable
ENV PORT=8082
ENV NODE_ENV=production

# Run the backend server using tsx
CMD ["npx", "tsx", "server/index.ts"]
