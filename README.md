# DevOrbit

This app serves a static frontend and an Express backend API. Code execution is queued through Bull/Redis and processed through Judge0.

## Architecture

```text
Frontend
  ->
Backend API
  ->
Bull queue / Redis
  ->
Judge0
```

## Local Run

1. Install Node.js 20+.
2. Start Redis locally, or point `REDIS_URL` at a hosted Redis instance.
3. Start the app from the repo root:

```bash
npm start
```

`npm start` launches the static frontend and backend API when using the default same-origin setup. The backend processes queue jobs in-process by default. To run the backend separately:

```bash
cd backend
npm install
node src/index.js
```

4. Open `http://127.0.0.1:3000`.

The backend processes execution queue jobs in-process by default. You can also run a dedicated worker:

```bash
npm run worker --prefix backend
```

If Redis is temporarily unavailable in local development, `EXECUTION_QUEUE_LOCAL_FALLBACK=true` keeps an in-process queue active so code runs do not fail while you bring Redis up. Production should use a real Redis URL.

## Deployment

This repo includes the app code, backend API, Redis/Bull queue, and Judge0-based execution flow.

- The frontend is served as static files.
- The backend exposes the API routes.
- The backend enqueues `/api/run` and submission execution jobs through Bull.
- Redis is required while `EXECUTION_QUEUE_ENABLED` is enabled.

The included `render.yaml` deploys:

- one web service that only adds execution jobs to the queue
- one private Render Key Value instance with `noeviction`
- two background-worker instances, each processing up to 10 jobs concurrently

This gives 20 concurrent execution slots. A burst of 100 Run/Submit requests is retained in Redis and processed in batches. Final submissions use a higher queue priority than ordinary runs so Run traffic cannot indefinitely delay submissions.

This capacity assumes your configured Judge0 service can accept 20 concurrent requests. Use a paid/self-hosted Judge0 deployment sized for that traffic; the public Judge0 endpoint is not a production capacity guarantee.

Required backend env vars:

- `DATABASE_URL` or `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `REDIS_URL`

Execution env vars:

- `JUDGE0_URL`
- `JUDGE0_AUTH_TOKEN` if your Judge0 endpoint requires it
- `JUDGE0_AUTH_USER` if your Judge0 endpoint requires it
- `JUDGE0_LANGUAGE_ID_JAVASCRIPT` optional override
- `JUDGE0_LANGUAGE_ID_PYTHON` optional override
- `JUDGE0_LANGUAGE_ID_JAVA` optional override
- `EXECUTION_QUEUE_ENABLED` defaults to enabled; set to `false` only for emergency direct execution
- `EXECUTION_QUEUE_CONCURRENCY` controls concurrent jobs per worker instance; the Render worker uses `10`
- `EXECUTION_QUEUE_PROCESS_IN_APP` defaults to enabled so a single backend process can consume jobs
- `EXECUTION_QUEUE_LOCAL_FALLBACK` can be enabled for local development when Redis is not running
- `EXECUTION_QUEUE_DIRECT_FALLBACK` can be enabled for local development as a last-resort execution path if queue setup is wrong
- `EXECUTION_QUEUE_RESULT_TIMEOUT_MS` controls how long an API request can wait for a queued result; production uses 10 minutes
- `EXECUTION_QUEUE_ATTEMPTS` controls retry count; production uses `2`

For production, keep `EXECUTION_QUEUE_PROCESS_IN_APP`, `EXECUTION_QUEUE_LOCAL_FALLBACK`, and `EXECUTION_QUEUE_DIRECT_FALLBACK` set to `false` on the web service. This ensures every execution respects the shared queue's capacity.

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

The health responses include database and queue status. In production, MongoDB and Redis must both be available. In local development, `EXECUTION_QUEUE_LOCAL_FALLBACK=true` reports a degraded local queue instead of failing every run.

## Achievement Badges

- `Silver Solver` is awarded after more than 50 unique accepted problems.
- `Gold Solver` is awarded at 100 or more unique accepted problems.
- Badge tier and solved-problem count are persisted on the user record and refreshed from stored submissions.

## Notes

- Judge0 is still the execution provider, but active requests now pass through Bull first.
- The Docker Compose stack includes Redis and a dedicated execution worker.
