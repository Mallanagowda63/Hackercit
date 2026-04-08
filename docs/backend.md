# Backend: Hackercit

This document describes the backend implementation and how to run it locally.

Tech choices
- Node.js + Express: fast to iterate, great NPM ecosystem, good for JSON APIs and workers.
- MongoDB native driver: direct document access without Prisma setup or replica-set requirements.
- Redis + Bull: job queue for execution worker.
- Direct Judge0 execution for code runs and submissions.

Quick start (after cloning)

1. Copy env example:

```bash
cp backend/.env.example backend/.env
# update values as needed
```

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

4. Optionally verify the backend can reach MongoDB:

```bash
cd backend
npm run db:check
```

Notes
- The `/api/run` flow and submission execution now call Judge0 directly.
- Configure SMTP env for real email delivery.
- Add rate-limiting, input validation, and helmet for production readiness.
