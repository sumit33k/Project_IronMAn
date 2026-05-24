# Scripts

## setup.sh — One-time setup

Sets up the full Jarvis Command Center from scratch.

```bash
curl -fsSL https://raw.githubusercontent.com/sumit33k/project_ironman/main/scripts/setup.sh | bash
```

Or if you've already cloned the repo:

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Options

| Flag | Description |
|------|-------------|
| `--model MODEL` | Ollama model to pull (default: llama3.1) |
| `--no-seed` | Skip demo data |
| `--no-browser` | Don't auto-open browser |
| `--help` | Show help |
