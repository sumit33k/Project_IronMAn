# Graphify Hand Navigator

`graphify-hand-navigator` is a lightweight Mac-friendly Vite web app for exploring a Graphify knowledge graph with your hands. It renders a live mirrored webcam feed full screen, overlays a Cytoscape.js graph, and uses MediaPipe Tasks Vision Hand Landmarker for pinch, zoom, pull, swipe, and glowing hand-string effects.

The expected Graphify output is `graphify-out/graph.json` from the [`graphifyy`](https://github.com/safishamsi/graphify) CLI command `graphify`. The frontend reads the generated file from `public/graph.json` and falls back to a built-in demo graph when that file is missing.

## Requirements

- macOS with Terminal
- Node.js and npm
- git
- A browser with camera access, such as Chrome, Edge, or Safari
- Internet access the first time MediaPipe assets, npm packages, `uv`, or Graphify are installed

The startup script checks for `node`, `npm`, `git`, and `uv`. If `uv` is missing, it installs it with Astral's installer. When you pass a GitHub URL or local folder, the script also installs Graphify if the CLI is missing:

```bash
uv tool install graphifyy
```

## Run with a public GitHub repo

```bash
chmod +x start-mac.sh
./start-mac.sh https://github.com/owner/repo
```

Example:

```bash
./start-mac.sh https://github.com/safishamsi/graphify
```

The script will:

1. Remove the old `.graphify-work` folder.
2. Clone the public repo with `git clone --depth 1 <url> .graphify-work/repo`.
3. Run `graphify .` inside the cloned repo.
4. Copy `graphify-out/graph.json` into `public/graph.json` when Graphify produces it.
5. Run `npm install` if `node_modules` is missing.
6. Open `http://127.0.0.1:5173`.
7. Start Vite with `npm run dev`.

## Run with a local folder

```bash
./start-mac.sh /path/to/project
```

The script runs `graphify .` inside that local folder and copies `/path/to/project/graphify-out/graph.json` into this app's `public/graph.json` if the output exists.

## Run demo mode

```bash
./start-mac.sh
```

With no argument, the app starts using the existing `public/graph.json` if present. If it is not present, the browser loads a built-in demo graph so the interface still works.

## In-app controls

- **Public GitHub repo URL**: generates and copies the exact local Mac command, for example `./start-mac.sh 'https://github.com/owner/repo'`.
- **Raw `graph.json` URL**: loads a hosted Graphify/NetworkX node-link JSON file directly in the browser.
- **Selected node**: shows the current selected graph node.
- **Status**: reports graph loading, camera setup, MediaPipe tracking, and command-copy status.

## Gesture controls

MediaPipe tracks up to two hands.

- **One-hand pinch**: pinch thumb tip landmark `4` and index fingertip landmark `8` to grab the nearest graph node and move it.
- **Two-hand pinch distance**: pinch both hands and move them closer/farther to zoom the graph around the midpoint.
- **Two open hands close together**: with a node selected, place two non-pinched hands near each other to pull the selected node toward their midpoint.
- **Right-hand horizontal swipe**: with a node selected, swipe the right-most visible hand horizontally to traverse to a connected neighbor and center the graph on it.
- **String effects**: glowing canvas trails are drawn from the wrist/palm area to each fingertip.

## Why the browser does not build Graphify directly

A normal browser page cannot safely execute local shell commands, clone a GitHub repo into your filesystem, or run `graphify .`. That work must happen in a trusted local helper. This project uses `start-mac.sh` for the local steps and keeps the browser app focused on visualization, camera access, and gestures.

## Graph format support

The adapter accepts:

- Graphify/NetworkX-style `{ "nodes": [...], "links": [...] }`
- `{ "nodes": [...], "edges": [...] }`
- Cytoscape-like `{ "elements": [...] }` or `{ "elements": { "nodes": [...], "edges": [...] } }`

Node labels fall back in this order: `label`, `name`, `title`, `id`.

Edge endpoints fall back in this order: `source`/`target`, `from`/`to`, `src`/`dst`.

## Troubleshooting

### Camera permissions

- Open the app at `http://127.0.0.1:5173`.
- Allow camera access when your browser prompts you.
- If you denied access, reset site permissions in the browser and reload.
- Close other apps that may be exclusively using the camera.

### `graphify: command not found`

Run:

```bash
uv tool install graphifyy
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
graphify --help
```

Then try `./start-mac.sh ...` again.

### Missing Node.js

Install Node.js, then re-run the script:

```bash
brew install node
node --version
npm --version
```

### No `graphify-out/graph.json`

If Graphify completes without `graphify-out/graph.json`, the app will start in demo mode. Check the terminal output from `graphify .`, confirm the target repo/folder contains supported source files, and try a smaller or simpler repository.

### GitHub repo too large

Large repos can take a long time to clone and graph. The script uses `--depth 1`, but Graphify still has to inspect the working tree. Try a smaller repo, a narrowed local copy, or remove generated/vendor folders before running Graphify locally.

## Development commands

```bash
npm install
npm run dev
npm run build
```
