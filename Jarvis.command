#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════╗
# ║   Jarvis Command Center — one-click macOS launcher   ║
# ║                                                      ║
# ║   Double-click this file in Finder to start Jarvis.  ║
# ║   macOS Terminal opens automatically.                ║
# ║                                                      ║
# ║   First time only:                                   ║
# ║     chmod +x Jarvis.command                          ║
# ║   Or: right-click → Open (bypasses Gatekeeper)       ║
# ╚══════════════════════════════════════════════════════╝

REPO="$(cd "$(dirname "$0")" && pwd)"

# Self-heal: ensure start.sh is executable on every run.
chmod +x "$REPO/start.sh"

exec "$REPO/start.sh"
