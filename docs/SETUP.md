# Setup Guide

## System Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js     | 20+     | For Next.js frontend |
| npm         | 10+     | Package manager |
| Python      | 3.11+   | For FastAPI backend |
| Ollama      | Latest  | Local AI runtime |
| RAM         | 8GB+    | For local AI models |
| Disk        | 5–10 GB | For models |

## Supported Platforms

- macOS 13+
- Linux (Ubuntu 20.04+, Fedora, etc.)
- Windows 11 with WSL2

---

## Step 1 — Install Ollama

Download from https://ollama.ai/download

```bash
# macOS (or Linux one-liner)
curl -fsSL https://ollama.ai/install.sh | sh

# Start the Ollama server
ollama serve
```

Pull a model (choose based on your RAM):

```bash
ollama pull llama3.1      # 4.7 GB — best quality, needs 8GB RAM
ollama pull mistral       # 4.1 GB — good balance
ollama pull phi3          # 2.3 GB — fast, works on 4GB RAM
ollama pull qwen2.5:3b    # 1.9 GB — lightest option
```

Verify Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

---

## Step 2 — Clone and Configure

```bash
git clone https://github.com/sumit33k/project_ironman.git
cd project_ironman

# Copy environment config
cp .env.example .env

# Edit .env if needed (change model name, etc.)
nano .env
```

---

## Step 3 — Start the API

```bash
cd apps/api

# Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate     # Linux/macOS
# .venv\Scripts\activate      # Windows

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn app.main:app --reload --port 8000
```

The API will automatically:
- Create the SQLite database (`ironman.db`)
- Create all tables
- Register all AI agents

**Optional: Load demo data**

```bash
python -m app.seed
```

This adds 15 sample tasks across different statuses and categories.

**Verify the API:**

```bash
curl http://localhost:8000/health
# → {"status": "ok", "version": "1.0.0"}

curl http://localhost:8000/ai/health
# → {"ollama_available": true, "models": ["llama3.1"]}
```

API docs: http://localhost:8000/docs

---

## Step 4 — Start the Frontend

```bash
cd apps/web

# Install dependencies
npm install

# Start development server
npm run dev
```

Open: **http://localhost:3000**

---

## Step 5 — Verify Everything Works

1. Open http://localhost:3000 — you should see the Jarvis Command Center dashboard
2. If you seeded data, you'll see tasks in Today's Priorities
3. Check the AI status dot in Settings — should show "Ollama is running"
4. Try the command bar (⌘K): type "show me my priorities today"
5. Go to Agent Hub and run the Daily Briefing Agent

---

## Changing the AI Model

1. Open http://localhost:3000/settings
2. Update "Model" to your preferred Ollama model (e.g., `mistral`, `phi3`)
3. Click Save Settings

Or set via environment variable:
```bash
export OLLAMA_MODEL=mistral
```

---

## Troubleshooting

### "Ollama is not available" banner

```bash
# Make sure Ollama is running
ollama serve

# Check if it's accessible
curl http://localhost:11434/api/tags
```

### Tasks not loading

```bash
# Make sure the API is running on port 8000
curl http://localhost:8000/health

# Check CORS — API allows localhost:3000 by default
```

### `ModuleNotFoundError: No module named 'pydantic_settings'`

```bash
pip install pydantic-settings
```

### Frontend build errors

```bash
cd apps/web
rm -rf .next node_modules
npm install
npm run dev
```

### Database issues

```bash
# Reset the database (deletes all data!)
cd apps/api
rm -f ironman.db
uvicorn app.main:app --reload --port 8000
python -m app.seed  # re-seed demo data
```

---

## Production Deployment

The MVP is designed for local use. For team/production deployment:

1. Replace SQLite with PostgreSQL: set `DATABASE_URL` in `.env`
2. Use a process manager (PM2, systemd) for the API
3. Build the Next.js frontend: `npm run build && npm start`
4. Set up a reverse proxy (nginx) if needed
5. Keep Ollama on a dedicated machine with a GPU for better performance
