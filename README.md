# Project IronMAn — Local-First AI Personal Command Center

An open-source, local-first monorepo scaffold for a private AI command center to manage office work, personal tasks, reminders, routines, and delegated agent workflows.

## Stack

- **Frontend:** Next.js + React + Tailwind CSS (+ shadcn/ui-ready structure)
- **Backend:** FastAPI
- **Database:** PostgreSQL
- **Cache/Queue:** Redis
- **Local AI Runtime:** Ollama
- **Vector DB:** Qdrant
- **Automation:** n8n-ready integration path
- **Auth:** local dev auth placeholder (Keycloak-ready)
- **Containerization:** Docker Compose

## Monorepo Structure

- `apps/web` — Next.js web application + Daily Brief panel
- `apps/api` — FastAPI backend service + local Ollama integration
- `apps/web` — Next.js web application
- `apps/api` — FastAPI backend service
- `packages/shared` — shared TypeScript types
- `infra/docker-compose.yml` — local infra services
- `.github/workflows/ci.yml` — CI checks

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+
- Docker + Docker Compose

## 1) Start infrastructure services

```bash
cd infra
docker compose up -d
```

This starts:

- Postgres (`localhost:5432`)
- Redis (`localhost:6379`)
- Qdrant (`localhost:6333`)
- Ollama placeholder (`localhost:11434`)

## 2) Run the API (FastAPI)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Optional AI env vars:

```bash
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1
export OLLAMA_TIMEOUT_SECONDS=30
```

Health endpoint:

```bash
curl http://localhost:8000/health
```

Daily brief endpoint:

```bash
curl -X POST http://localhost:8000/ai/daily-brief \
  -H 'Content-Type: application/json' \
  -d '{
    "todays_tasks": ["Draft Q2 roadmap", "Review pull requests"],
    "overdue_tasks": ["Submit expense report"],
    "upcoming_meetings": ["10:00 Product sync", "14:00 1:1 with manager"],
    "pending_follow_ups": ["Reply to vendor quote"]
  }'
```

If Ollama is unavailable, the API returns a graceful `503` error.

## 3) Run the Web app (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

Open: `http://localhost:3000` and use the Daily Brief panel.

## 4) Shared package usage

`packages/shared` includes starter TypeScript types for tasks, routines, reminders, and delegated jobs.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

- Web lint + build
- API syntax/import check

## Notes

- All AI processing is local through Ollama.
- Prompt template is versioned at `apps/api/app/prompts/daily_brief_v1.txt`.
Health endpoint:

```bash
curl http://localhost:8000/health
```

## 3) Run the Web app (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

Open: `http://localhost:3000`

## 4) Shared package usage

`packages/shared` includes starter TypeScript types for tasks, routines, reminders, and delegated jobs.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

- Web lint + build
- API syntax/import check

## Notes

- This is an initial scaffold for local-first development.
- n8n, Keycloak, and deeper app modules can be added incrementally.
