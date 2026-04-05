# CodeArena Split Architecture

This project now uses a split architecture where the frontend talks to the backend API, and the backend forwards code execution to the Docker runner service.

## Architecture

```text
Frontend (React Native / Web)
        ↓
Backend API (4000)
        ↓
Code Runner Service (3000 + Docker)
```

## What it does

- Serves the existing web frontend from the runner service
- Exposes the backend API on port `4000`
- Forwards `POST /api/run` from the backend to the runner service
- Runs JavaScript, Python, and Java inside Docker containers
- Applies basic isolation:
  - `--rm`
  - `--network none`
  - memory limit
  - CPU limit

## Run it

1. Install Node.js 20+.
2. Install Docker Desktop and make sure Linux containers are enabled.
3. Start the runner service from this folder:

```bash
npm start
```

4. Start the backend API:

```bash
cd backend
npm install
node src/index.js
```

5. Open `http://127.0.0.1:3000`.

## Frontend Backend Configuration

The frontend now defaults to same-origin API calls through this tag in `index.html`:

```html
<meta name="codearena-backend-api-base" content="same-origin" />
```

- Local development:
  - the runner on `http://127.0.0.1:3000` proxies auth/problem/test/submission APIs to the backend on `http://127.0.0.1:4000`
  - `/api/run` still executes through the runner service on `:3000`
- Vercel deployment:
  - `/api/*` is served by `api/[...path].js`, which reuses the backend Express app on the same host
- Split deployment:
  - if you host the backend somewhere else, set an explicit backend URL instead:

```html
<meta name="codearena-backend-api-base" content="https://your-backend.example.com" />
```

## Deployment Notes

This project is not a frontend-only app. The full flow depends on:

- a backend API on `http://127.0.0.1:4000`
- a code runner service on `http://127.0.0.1:3000`
- Docker installed on the deployment machine
- permission for the runner process to run `docker`

If you deploy this repo to Vercel, the frontend and `/api/*` can share the same host. You still need to provide the backend environment variables and a reachable code runner URL.

For deployment, you need one of these:

1. A VPS or server where you install:
   - Node.js
   - Docker
   - this project

2. A platform that supports a long-running Node server and Docker access.

3. A split setup where:
   - the frontend and backend API run on Vercel
   - the code runner lives on a VM/VPS or other host that can run Docker
   - `CODE_RUNNER_URL` points at that runner host

4. An external execution service, if your deployment platform does not allow Docker access.

## Health Check

The services now expose:

```text
GET http://127.0.0.1:3000/api/health
GET http://127.0.0.1:4000/health
GET http://127.0.0.1:4000/api/run/health
```

Example response:

```json
{
  "ok": true,
  "service": "codearena",
  "dockerRequired": true
}
```

## Important Limitation

Most modern frontend hosting platforms do not allow you to run Docker commands from your app server.

So for production deployment:

- if you deploy on your own VM/VPS: this Docker runner approach works
- if you deploy on a restricted platform: use an external judge API instead of local Docker

## Docker images used

- JavaScript: `node:20-alpine`
- Python: `python:3.11-alpine`
- Java: `eclipse-temurin:17-jdk`

## Request shape

```json
{
  "language": "python",
  "sourceCode": "def twoSum(nums, target):\n    return [0, 1]",
  "fnName": "twoSum",
  "testCases": [
    { "input": "[2,7,11,15], 9", "expected": "[0,1]" }
  ]
}
```

## Requirements you still need to provide

- Docker installed locally
- Permission to run Docker from your user account
- Final language/problem list if you want more than the current 4 built-in problems
- Judge rules if you want:
  - hidden tests
  - time limit per problem
  - memory limit per problem
  - custom stdin problems
  - plagiarism checks

## Current scope

- Built for the 4 problems already present in the frontend
- Java runner is tailored to those existing function signatures
- Good starter architecture, not production-hardening yet

## Next recommended upgrades

- Queue submissions instead of running inline in the HTTP request
- Store submission history
- Add auth
- Add per-problem limits
- Add read-only filesystem and non-root containers
