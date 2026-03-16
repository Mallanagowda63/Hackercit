# CodeArena Docker Runner

This project now includes a minimal backend API for Docker-based code execution.

## What it does

- Serves the existing frontend
- Exposes `POST /api/run`
- Runs JavaScript, Python, and Java inside Docker containers
- Applies basic isolation:
  - `--rm`
  - `--network none`
  - memory limit
  - CPU limit

## Run it

1. Install Node.js 20+.
2. Install Docker Desktop and make sure Linux containers are enabled.
3. From this folder, run:

```bash
npm start
```

4. Open `http://127.0.0.1:3000`.

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
