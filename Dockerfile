# Use the official Microsoft Playwright image that includes Node.js and all browser dependencies
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Create and set application directory
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies clean and fast
RUN npm ci

# Copy all project files into the container
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the Node.js application
CMD ["npm", "start"]
