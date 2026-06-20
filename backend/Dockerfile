FROM node:18-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --only=production
COPY backend/ ./
COPY runner /runner
ENV NODE_ENV=production
CMD ["node","src/index.js"]
