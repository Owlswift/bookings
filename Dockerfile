# Updated Dockerfile
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

# Verify build output
RUN npm run build && ls -l dist/  # Lists build output to catch failures

EXPOSE 3000
CMD ["npm", "run", "start:prod"]