# Graphify Hand Navigator

A lightweight Mac-friendly browser app that uses:

- Graphify `graphify-out/graph.json` as the graph source
- A public GitHub URL or local folder as the input source
- MediaPipe Hand Landmarker for two-hand tracking
- Cytoscape.js for interactive graph rendering
- A live mirrored camera layer plus canvas "string" effects

## One-click Mac start with a public GitHub repo

```bash
chmod +x start-mac.sh
./start-mac.sh https://github.com/owner/repo
```

Example:

```bash
./start-mac.sh https://github.com/safishamsi/graphify
```

The script will:

1. Clone the public repo into `.graphify-work/repo`
2. Install/use Graphify through the `graphifyy` package
3. Run `graphify .`
4. Copy `graphify-out/graph.json` into `public/graph.json`
5. Install web dependencies
6. Open `http://127.0.0.1:5173`

## Start with a local folder

```bash
./start-mac.sh /path/to/project-you-want-to-graph
```

## Start with the demo graph

```bash
./start-mac.sh
```

## In-app GitHub URL field

The UI includes a public GitHub repo field. Because a normal browser page cannot directly run `git clone` or Graphify on your Mac, submitting that field gives you the exact launcher command and copies it to your clipboard:

```bash
./start-mac.sh "https://github.com/owner/repo"
```

The UI also includes an optional raw `graph.json` URL field. This is useful if you already have a hosted JSON graph file, for example from a public raw GitHub URL.

## Gestures

- One-hand pinch: grab and move the nearest node
- Two-hand pinch distance: zoom in/out
- Two open hands close together: pull the selected node toward the midpoint
- Right-hand swipe: jump to a neighboring node
