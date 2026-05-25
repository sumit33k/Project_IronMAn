# Jarvis Command Center — Desktop Setup Guide

macOS (Apple Silicon) desktop app using Tauri v2. The app lives in your system tray and wraps the local Next.js + FastAPI stack.

---

## Prerequisites

### 1. Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Node.js 20+

```bash
brew install node
node --version   # should be 20+
```

### 3. Python 3.11+

```bash
brew install python@3.11
python3 --version
```

### 4. Rust (required to build or update the desktop app)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
rustc --version
```

### 5. PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 6. Ollama (local AI)

```bash
brew install ollama
brew services start ollama

# Pull the recommended model (needs ~5 GB, 16 GB RAM recommended)
ollama pull llama3.1

# Verify
curl http://localhost:11434/api/tags
```

### 7. Tauri system dependencies (macOS — already included via Xcode tools)

```bash
xcode-select --install   # if not already installed
```

---

## First-Time Setup

### 1. Clone the repository

```bash
git clone https://github.com/sumit33k/project_ironman.git
cd project_ironman
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` — the only required changes for a basic local setup:

```env
DATABASE_URL=postgresql://ironman:ironman@localhost:5432/ironman
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

Google Calendar and Gmail integration require additional setup — see [Google OAuth Setup](#google-oauth-setup) below.

### 3. Run the startup script

```bash
chmod +x start.sh
./start.sh
```

`start.sh` automatically:
- Checks for PostgreSQL and starts it via Homebrew if needed
- Creates the `ironman` database and user (first run only)
- Creates and activates the Python virtual environment
- Installs Python dependencies
- Runs `alembic upgrade head` to apply all database migrations
- Starts the FastAPI backend on port 8000
- Installs Node dependencies
- Starts the Next.js frontend on port 3000

Open **http://localhost:3000** — the web interface is now running.

---

## Building the Desktop App (.app / .dmg)

Run this once to produce the native macOS app bundle. Requires Rust to be installed.

```bash
cd apps/desktop
npm install
npm run build
```

Build output (takes 5–15 min on first run, fast on subsequent runs):

```
apps/desktop/src-tauri/target/release/bundle/
  macos/
    Jarvis Command Center.app      ← drag to /Applications
  dmg/
    Jarvis Command Center_0.1.0_aarch64.dmg  ← installer
```

### Install

Drag **Jarvis Command Center.app** to your `/Applications` folder, or double-click the `.dmg` to install.

> **Gatekeeper note:** On first launch macOS may warn "app from unidentified developer". Right-click → Open to bypass, or run:
> ```bash
> xattr -dr com.apple.quarantine "/Applications/Jarvis Command Center.app"
> ```

---

## Launching the App

### Option A — Always via start.sh (recommended)

`start.sh` starts the API + frontend, then you launch the desktop app from `/Applications`. The Tauri window loads `http://localhost:3000`.

```bash
./start.sh   # starts backend + frontend in the background
open "/Applications/Jarvis Command Center.app"
```

### Option B — Start on Login (auto-start)

1. Launch the app
2. Click the Jarvis icon in the menu bar
3. Click **Start on Login** — this registers a macOS LaunchAgent
4. The app will start automatically on every login

The system tray controls:

| Action | Result |
|--------|--------|
| Left-click tray icon | Toggle window show/hide |
| Right-click → Show Jarvis | Bring window to front |
| Right-click → Hide Jarvis | Hide to tray |
| Right-click → Start on Login | Toggle auto-start |
| Right-click → Quit Jarvis | Exit completely |
| Close button (×) | Hides to tray (does not quit) |

---

## Google OAuth Setup

Enables real Google Calendar and Gmail sync.

### 1. Create Google Cloud credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable APIs: **Gmail API** and **Google Calendar API**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:8000/integrations/google/callback`
7. Copy the **Client ID** and **Client Secret**

### 2. Add to `.env`

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/integrations/google/callback
```

Restart the backend after editing `.env`.

### 3. Connect in the app

1. Open the app → navigate to **Integrations**
2. Click **Connect Google Calendar** or **Connect Gmail**
3. Authorize in the browser popup
4. Both Calendar and Gmail will activate with a single OAuth flow
5. Click **Sync** to import events and emails

---

## Updating the App

```bash
cd project_ironman
git pull origin main
./start.sh   # applies any new migrations automatically
```

To rebuild the desktop binary after code changes:

```bash
cd apps/desktop
npm run build
# Replace the app in /Applications with the new build
```

---

## Database Management

### Run migrations manually

```bash
cd apps/api
source .venv/bin/activate
DATABASE_URL=postgresql://ironman:ironman@localhost:5432/ironman alembic upgrade head
```

### Seed demo data (optional)

```bash
cd apps/api
source .venv/bin/activate
python -m app.seed
```

### Connect to the database directly

```bash
psql -U ironman -d ironman
```

### Reset the database (deletes all data)

```bash
psql -U ironman -d ironman -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cd apps/api && source .venv/bin/activate
DATABASE_URL=postgresql://ironman:ironman@localhost:5432/ironman alembic upgrade head
```

---

## Troubleshooting

### App window is blank / "Failed to fetch"

The backend or frontend isn't running. Start them:

```bash
./start.sh
```

Check both services:

```bash
curl http://localhost:8000/health    # API
curl http://localhost:3000           # Frontend
```

### PostgreSQL won't start

```bash
brew services restart postgresql@16

# Check logs
tail -50 /opt/homebrew/var/log/postgresql@16/postgresql.log
```

If the data directory is missing:

```bash
initdb /opt/homebrew/var/postgresql@16
brew services start postgresql@16
```

### "database 'ironman' does not exist"

```bash
psql postgres -c "CREATE USER ironman WITH PASSWORD 'ironman';"
psql postgres -c "CREATE DATABASE ironman OWNER ironman;"
```

### Ollama not available (AI banner in app)

```bash
brew services restart ollama
curl http://localhost:11434/api/tags
```

If the model isn't pulled:

```bash
ollama pull llama3.1
```

### Tauri build fails: "xcode-select: error"

```bash
xcode-select --install
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer  # if Xcode is installed
```

### "Gatekeeper blocked the app" on macOS

```bash
xattr -dr com.apple.quarantine "/Applications/Jarvis Command Center.app"
```

### Auto-start not working

The LaunchAgent plist is written to `~/Library/LaunchAgents/`. Verify:

```bash
launchctl list | grep ironman
ls ~/Library/LaunchAgents/ | grep ironman
```

To manually reset:

```bash
launchctl remove com.ironman.jarvis
# Then re-enable via tray menu → Start on Login
```

---

## File Locations

| What | Where |
|------|-------|
| Environment config | `project_ironman/.env` |
| PostgreSQL data | `/opt/homebrew/var/postgresql@16/` |
| Ollama models | `~/.ollama/models/` |
| App logs (API) | Terminal running `start.sh` |
| LaunchAgent plist | `~/Library/LaunchAgents/com.ironman.jarvis.plist` |
| Desktop app | `/Applications/Jarvis Command Center.app` |
| Database migrations | `apps/api/alembic/versions/` |
