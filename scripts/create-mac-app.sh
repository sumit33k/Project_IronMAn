#!/usr/bin/env bash
# Creates a double-clickable "Jarvis Command Center.app" in the repo root.
# The .app can be moved to /Applications or dragged into the Dock.
#
# Usage:
#   bash scripts/create-mac-app.sh
#
# Requirements: macOS with osacompile (ships with Xcode Command Line Tools)

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[create-app]${NC} $*"; }
success() { echo -e "${GREEN}[create-app]${NC} $*"; }
fatal()   { echo -e "${RED}[create-app]${NC} ERROR: $*" >&2; exit 1; }

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Jarvis Command Center"
APP_OUT="$REPO/$APP_NAME.app"

[[ "$(uname)" == "Darwin" ]] || fatal "This script only runs on macOS."
command -v osacompile &>/dev/null || fatal "osacompile not found. Install Xcode Command Line Tools: xcode-select --install"

echo -e "${BOLD}Building $APP_NAME.app...${NC}"

# ── AppleScript source ───────────────────────────────────────────────────────
TMP_SCRIPT="$(mktemp /tmp/jarvis-applescript-XXXX.applescript)"
trap 'rm -f "$TMP_SCRIPT"' EXIT

cat > "$TMP_SCRIPT" <<'APPLESCRIPT'
on run
    -- Resolve repo root (parent folder of the .app bundle)
    set appPath to POSIX path of (path to me)
    set repoFolder to do shell script "dirname " & quoted form of appPath

    -- Ensure start.sh is executable
    do shell script "chmod +x " & quoted form of (repoFolder & "/start.sh")

    -- Open a fresh Terminal window and run start.sh
    tell application "Terminal"
        activate
        do script "cd " & quoted form of repoFolder & " && bash start.sh"
    end tell
end run
APPLESCRIPT

# ── Compile .app ─────────────────────────────────────────────────────────────
[[ -d "$APP_OUT" ]] && { info "Removing existing $APP_NAME.app..."; rm -rf "$APP_OUT"; }

osacompile -o "$APP_OUT" "$TMP_SCRIPT"
success "Compiled AppleScript app"

# ── Optional: apply the Tauri/IronMan icon ───────────────────────────────────
ICON_SRC="$REPO/apps/desktop/src-tauri/icons/128x128.png"

if [[ -f "$ICON_SRC" ]] && command -v sips &>/dev/null && command -v iconutil &>/dev/null; then
  info "Applying custom icon from $ICON_SRC..."

  ICONSET_DIR="$(mktemp -d)/icon.iconset"
  mkdir -p "$ICONSET_DIR"

  for size in 16 32 64 128 256 512; do
    sips -z "$size" "$size" "$ICON_SRC" \
      --out "$ICONSET_DIR/icon_${size}x${size}.png" &>/dev/null || true
  done
  # @2x variants
  for size in 16 32 128 256; do
    double=$((size * 2))
    sips -z "$double" "$double" "$ICON_SRC" \
      --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" &>/dev/null || true
  done

  ICNS_OUT="$(mktemp -d)/icon.icns"
  if iconutil -c icns "$ICONSET_DIR" -o "$ICNS_OUT" 2>/dev/null && [[ -f "$ICNS_OUT" ]]; then
    # osacompile puts its default icon at Contents/Resources/droplet.icns
    cp "$ICNS_OUT" "$APP_OUT/Contents/Resources/droplet.icns"
    success "Custom icon applied"
  else
    info "iconutil failed — using default osacompile icon"
  fi
else
  info "Skipping custom icon (icon file or sips/iconutil not available)"
fi

# ── Remove macOS quarantine flag so first launch doesn't require confirmation ─
xattr -dr com.apple.quarantine "$APP_OUT" 2>/dev/null || true

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  ✓ Created: $APP_OUT${NC}"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo -e "  1. Double-click ${BOLD}'$APP_NAME.app'${NC} to launch Jarvis"
echo -e "  2. To add to Dock: drag the .app onto the Dock"
echo -e "  3. To add to Applications: drag to /Applications"
echo ""
echo -e "  Note: On first open macOS may still ask to confirm."
echo -e "  → System Settings → Privacy & Security → 'Open Anyway'"
echo ""
