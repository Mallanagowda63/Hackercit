# Backend: Hackercit

This document describes the backend implementation and how to run it locally.

Tech choices
- Node.js + Express: fast to iterate, great NPM ecosystem, good for JSON APIs and workers.
- MongoDB native driver: direct document access without Prisma setup or replica-set requirements.
- Redis + Bull: job queue for execution worker.
- Docker Compose: containerized services for local/dev.

Quick start (after cloning)

1. Copy env example:

```bash
cp backend/.env.example backend/.env
# update values as needed
```

2. Build and run with docker compose (recommended):

```bash
cd docker
docker-compose up --build
```

3. Optionally verify the backend can reach MongoDB:

```bash
cd backend
npm run db:check
```

Notes
- Worker currently runs untrusted JS in a simple exec wrapper for demo. Replace with a hardened Docker sandbox for production.
- Configure SMTP env for real email delivery.
- Add rate-limiting, input validation, and helmet for production readiness.
