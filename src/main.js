import cytoscape from "cytoscape";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { graphifyToCytoscape } from "./graphifyAdapter.js";
import "./style.css";

const video = document.getElementById("webcam");
const canvas = document.getElementById("effects");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const selectedEl = document.getElementById("selected");
const githubForm = document.getElementById("githubForm");
const githubUrlInput = document.getElementById("githubUrl");
const jsonForm = document.getElementById("jsonForm");
const jsonUrlInput = document.getElementById("jsonUrl");

let cy;
let landmarker;
let lastVideoTime = -1;
let grabbedNode = null;
let selectedNode = null;
let lastTwoHandDistance = null;
let lastRightX = null;
const trails = [];

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

async function fetchGraphJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load graph JSON: ${res.status}`);
  return graphifyToCytoscape(await res.json());
}

async function loadGraph() {
  const params = new URLSearchParams(window.location.search);
  const graphUrl = params.get("graphUrl");

  if (graphUrl) {
    statusEl.textContent = "Loading graph JSON from URL...";
    return fetchGraphJson(graphUrl);
  }

  try {
    return await fetchGraphJson("/graph.json");
  } catch {
    statusEl.textContent = "No public/graph.json yet, using demo graph. Run ./start-mac.sh https://github.com/owner/repo to build one.";
    return graphifyToCytoscape(null);
  }
}

function replaceGraph(elements) {
  cy.elements().remove();
  cy.add(elements);
  cy.layout({ name: "cose", animate: true, fit: true, padding: 60 }).run();
  grabbedNode = null;
  selectedNode = null;
  selectedEl.textContent = "Selected: none";
}

function initForms() {
  githubForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = githubUrlInput.value.trim();
    if (!url) return;
    const command = `./start-mac.sh "${url}"`;
    statusEl.textContent = `To build this public GitHub repo on Mac, stop this server and run: ${command}`;
    navigator.clipboard?.writeText(command).catch(() => {});
  });

  jsonForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = jsonUrlInput.value.trim();
    if (!url) return;
    try {
      statusEl.textContent = "Loading raw graph JSON URL...";
      replaceGraph(await fetchGraphJson(url));
      statusEl.textContent = "Loaded graph JSON URL. Show your hands to control it.";
    } catch (err) {
      statusEl.textContent = `Could not load graph JSON URL: ${err.message}`;
    }
  });
}

function initGraph(elements) {
  cy = cytoscape({
    container: document.getElementById("cy"),
    elements,
    layout: { name: "cose", animate: true, fit: true, padding: 60 },
    style: [
      {
        selector: "node",
        style: {
          "background-color": "#78d7ff",
          "border-width": 2,
          "border-color": "#ffffff",
          "label": "data(label)",
          "font-size": 11,
          "color": "#ffffff",
          "text-outline-color": "#07111f",
          "text-outline-width": 3,
          "width": 28,
          "height": 28
        }
      },
      {
        selector: "node:selected, node.activeHand",
        style: {
          "background-color": "#ffdc73",
          "width": 42,
          "height": 42,
          "font-size": 14
        }
      },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "line-color": "rgba(200,230,255,0.28)",
          "target-arrow-shape": "triangle",
          "target-arrow-color": "rgba(200,230,255,0.45)",
          "width": 1.5
        }
      }
    ],
    minZoom: 0.08,
    maxZoom: 4
  });

  cy.on("tap", "node", (evt) => selectNode(evt.target));
}

function selectNode(node) {
  if (!node) return;
  cy.nodes().removeClass("activeHand");
  selectedNode = node;
  node.addClass("activeHand");
  selectedEl.textContent = `Selected: ${node.data("label") || node.id()}`;
}

function screenToGraphPoint(x, y) {
  const pan = cy.pan();
  const zoom = cy.zoom();
  return { x: (x - pan.x) / zoom, y: (y - pan.y) / zoom };
}

function nearestNode(x, y) {
  const p = screenToGraphPoint(x, y);
  let best = null;
  let bestDist = Infinity;
  cy.nodes().forEach((node) => {
    const pos = node.position();
    const d = Math.hypot(pos.x - p.x, pos.y - p.y);
    if (d < bestDist) {
      best = node;
      bestDist = d;
    }
  });
  return best;
}

function pinchPoint(hand) {
  const thumb = hand[4];
  const index = hand[8];
  const x = (1 - (thumb.x + index.x) / 2) * canvas.clientWidth;
  const y = ((thumb.y + index.y) / 2) * canvas.clientHeight;
  const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  return { x, y, pinched: distance < 0.055, distance };
}

function palmCenter(hand) {
  const ids = [0, 5, 9, 13, 17];
  const avg = ids.reduce((acc, id) => ({ x: acc.x + hand[id].x, y: acc.y + hand[id].y }), { x: 0, y: 0 });
  return {
    x: (1 - avg.x / ids.length) * canvas.clientWidth,
    y: (avg.y / ids.length) * canvas.clientHeight
  };
}

function drawStringEffects(hands) {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  hands.forEach((hand) => {
    const wrist = palmCenter(hand);
    const tips = [4, 8, 12, 16, 20].map((id) => ({
      x: (1 - hand[id].x) * canvas.clientWidth,
      y: hand[id].y * canvas.clientHeight
    }));

    tips.forEach((tip) => {
      trails.push({ x1: wrist.x, y1: wrist.y, x2: tip.x, y2: tip.y, life: 1 });
    });
  });

  for (let i = trails.length - 1; i >= 0; i--) {
    const t = trails[i];
    ctx.globalAlpha = t.life;
    ctx.lineWidth = 2 + 4 * t.life;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    const mx = (t.x1 + t.x2) / 2;
    const my = (t.y1 + t.y2) / 2 - 35 * t.life;
    ctx.quadraticCurveTo(mx, my, t.x2, t.y2);
    ctx.strokeStyle = "rgba(140, 220, 255, 0.9)";
    ctx.stroke();
    t.life -= 0.035;
    if (t.life <= 0) trails.splice(i, 1);
  }
  ctx.globalAlpha = 1;
}

function handleGestures(hands) {
  if (!cy || !hands.length) {
    grabbedNode = null;
    lastTwoHandDistance = null;
    lastRightX = null;
    return;
  }

  const pinches = hands.map(pinchPoint);
  const primary = pinches[0];

  // One-hand pinch: grab nearest node and move it.
  if (primary.pinched && hands.length === 1) {
    if (!grabbedNode) {
      grabbedNode = nearestNode(primary.x, primary.y);
      selectNode(grabbedNode);
    }
    grabbedNode.position(screenToGraphPoint(primary.x, primary.y));
  } else if (hands.length === 1) {
    grabbedNode = null;
  }

  // Two-hand pinch distance: zoom.
  if (hands.length >= 2) {
    const a = pinches[0];
    const b = pinches[1];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (a.pinched && b.pinched) {
      if (lastTwoHandDistance) {
        const ratio = distance / lastTwoHandDistance;
        cy.zoom({
          level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * ratio)),
          renderedPosition: midpoint
        });
      }
      lastTwoHandDistance = distance;
    } else {
      lastTwoHandDistance = null;
    }

    // Two open hands close together: pull selected node to midpoint.
    if (!a.pinched && !b.pinched && distance < 190 && selectedNode) {
      const target = screenToGraphPoint(midpoint.x, midpoint.y);
      const current = selectedNode.position();
      selectedNode.position({
        x: current.x + (target.x - current.x) * 0.2,
        y: current.y + (target.y - current.y) * 0.2
      });
    }
  }

  // Right-hand horizontal swipe: jump among neighbors like graph traversal.
  const right = hands[hands.length - 1];
  const rightPalm = palmCenter(right);
  if (lastRightX !== null && Math.abs(rightPalm.x - lastRightX) > 85 && selectedNode) {
    const outgoing = selectedNode.connectedEdges().connectedNodes().difference(selectedNode);
    if (outgoing.length) {
      const currentIndex = Math.max(0, outgoing.indexOf(selectedNode));
      const next = outgoing[Math.floor(Math.random() * outgoing.length)];
      selectNode(next);
      cy.animate({ center: { eles: next }, zoom: Math.max(cy.zoom(), 1.1) }, { duration: 240 });
    }
    lastRightX = rightPalm.x;
  } else if (lastRightX === null) {
    lastRightX = rightPalm.x;
  } else {
    lastRightX = rightPalm.x;
  }
}

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

async function setupHands() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
  );

  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55
  });
}

function loop() {
  if (video.currentTime !== lastVideoTime && landmarker) {
    lastVideoTime = video.currentTime;
    const result = landmarker.detectForVideo(video, performance.now());
    const hands = result.landmarks || [];
    drawStringEffects(hands);
    handleGestures(hands);
    statusEl.textContent = hands.length
      ? `${hands.length} hand(s) tracked. Use pinch, two-hand zoom, close hands, and swipes.`
      : "Show one or two hands to the camera.";
  }
  requestAnimationFrame(loop);
}

async function main() {
  initForms();
  initGraph(await loadGraph());
  await setupCamera();
  await setupHands();
  statusEl.textContent = "Ready. Show your hands to control the graph.";
  requestAnimationFrame(loop);
}

main().catch((err) => {
  console.error(err);
  statusEl.textContent = `Startup error: ${err.message}`;
});
