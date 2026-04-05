FROM node:18-alpine
WORKDIR /worker
COPY ../../backend/package.json ../../backend/package-lock.json* ./
RUN npm ci --only=production
COPY ../../backend .
WORKDIR /worker
CMD ["node","src/worker.js"]
