# Use a lightweight Node.js image
FROM node:16-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Ensure the container listens on the correct port
EXPOSE 8080

# Use the command to start the WebSocket server
CMD ["node", "server.js"]
