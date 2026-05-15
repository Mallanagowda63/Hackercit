# DevOrbit

This app serves a static frontend and an Express backend API. Code execution is handled through Judge0.

## Architecture

```text
Frontend
  ->
Backend API
  ->
Judge0
```

## Local Run

1. Install Node.js 20+.
2. Start the frontend/static server from the repo root:

```bash
npm start
```

3. Start the backend API:

```bash
cd backend
npm install
node src/index.js
```

4. Open `http://127.0.0.1:3000`.

## Deployment

This repo includes the app code, backend API, and Judge0-based execution flow.

- The frontend is served as static files.
- The backend exposes the API routes.
- The backend calls Judge0 directly for `/api/run` and submission execution.

Required backend env vars:

- `DATABASE_URL` or `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`

Execution env vars:

- `JUDGE0_URL`
- `JUDGE0_AUTH_TOKEN` if your Judge0 endpoint requires it
- `JUDGE0_AUTH_USER` if your Judge0 endpoint requires it
- `JUDGE0_LANGUAGE_ID_JAVASCRIPT` optional override
- `JUDGE0_LANGUAGE_ID_PYTHON` optional override
- `JUDGE0_LANGUAGE_ID_JAVA` optional override

Default Judge0 CE language ids:

- JavaScript: `63`
- Python: `71`
- Java: `62`

## Frontend API Base

The frontend defaults to same-origin API calls:

```html
<meta name="codearena-backend-api-base" content="same-origin" />
```

Use an explicit backend URL only if you host the backend separately.

## Health Checks

Available endpoints:

```text
GET /api/health
GET /api/run/health
GET /health
```

## Achievement Badges

- `Silver Solver` is awarded after more than 50 unique accepted problems.
- `Gold Solver` is awarded at 100 or more unique accepted problems.
- Badge tier and solved-problem count are persisted on the user record and refreshed from stored submissions.

## Notes

- Judge0 is the recommended execution path for deployment.
- The old Docker files are still in the repo as legacy local infrastructure, but deployment no longer depends on them.
- The old Redis/Bull worker path is no longer used by the active `/api/run` and submission routes.
