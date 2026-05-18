#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT="${1:-}"
WORK_DIR="$APP_DIR/.graphify-work"
TARGET_DIR=""

echo "Graphify Hand Navigator"
echo "======================="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it with Homebrew: brew install node"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. It normally comes with Node.js."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required. Install it with Homebrew: brew install git"
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found. Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

if ! command -v graphify >/dev/null 2>&1; then
  echo "Installing Graphify CLI package graphifyy..."
  uv tool install graphifyy
  export PATH="$HOME/.local/bin:$PATH"
fi

if [[ "$INPUT" =~ ^https://github.com/[^/]+/[^/]+/?$ ]] || [[ "$INPUT" =~ ^git@github.com:.+/.+\.git$ ]] || [[ "$INPUT" =~ ^https://github.com/.+/.+\.git$ ]]; then
  echo "Public GitHub repo URL detected: $INPUT"
  rm -rf "$WORK_DIR"
  mkdir -p "$WORK_DIR"
  TARGET_DIR="$WORK_DIR/repo"
  echo "Cloning repository..."
  git clone --depth 1 "$INPUT" "$TARGET_DIR"
elif [ -n "$INPUT" ]; then
  if [ ! -d "$INPUT" ]; then
    echo "Input is not a valid local folder or GitHub repo URL: $INPUT"
    echo "Examples:"
    echo "  ./start-mac.sh https://github.com/safishamsi/graphify"
    echo "  ./start-mac.sh /path/to/local/project"
    exit 1
  fi
  TARGET_DIR="$INPUT"
fi

if [ -n "$TARGET_DIR" ]; then
  echo "Building Graphify knowledge graph from: $TARGET_DIR"
  (cd "$TARGET_DIR" && graphify .)

  if [ -f "$TARGET_DIR/graphify-out/graph.json" ]; then
    cp "$TARGET_DIR/graphify-out/graph.json" "$APP_DIR/public/graph.json"
    echo "Copied graphify-out/graph.json into app/public/graph.json"
  else
    echo "Graphify finished but graphify-out/graph.json was not found."
    echo "The app will start with its demo graph."
  fi
else
  echo "No input passed. Starting with existing public/graph.json or demo graph."
  echo "Usage:"
  echo "  ./start-mac.sh https://github.com/owner/repo"
  echo "  ./start-mac.sh /path/to/project-you-want-to-graph"
fi

cd "$APP_DIR"
if [ ! -d node_modules ]; then
  echo "Installing web app dependencies..."
  npm install
fi

echo "Opening http://127.0.0.1:5173"
(open "http://127.0.0.1:5173" >/dev/null 2>&1 || true)
npm run dev
