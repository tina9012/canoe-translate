# Use Node.js base image
FROM node:18 AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the React app
RUN npm run build

# Use a lightweight web server for production
FROM node:18
WORKDIR /app
COPY --from=build /app/build ./build

# Install only production dependencies for the server
RUN npm install express

# Expose port 8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
