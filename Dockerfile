 # Use an official Node.js runtime as a parent image

FROM node:18
 
# Set the working directory in the container

WORKDIR /app
 
# Copy package.json and package-lock.json to the working directory

#COPY package*.json ./
 
# Copy the rest of the application code to the working directory

# COPY . .

COPY . /app
 
# Install dependencies

RUN npm install
 
# Expose port 5000

EXPOSE 80

EXPOSE 5000

EXPOSE 587
 
# Ensure all required directories/files exist

#RUN mkdir -p /app/Backend/Model
 
# Start the application

CMD ["node", "app.js"]
 