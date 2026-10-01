# DevOrbit: frontend server (hacker.js) + backend API in one image.
# hacker.js serves the site on PORT and starts the backend on BACKEND_PORT.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first so code changes don't redo npm install.
# The root postinstall installs backend/ dependencies too.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

ENV HOST=0.0.0.0 PORT=3000 BACKEND_PORT=4000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "hacker.js"]
