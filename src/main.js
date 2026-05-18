import cytoscape from "cytoscape";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { graphifyToCytoscape } from "./graphifyAdapter.js";
import "./style.css";

const MEDIAPIPE_VERSION = "0.10.22-rc.20250304";
const PINCH_THRESHOLD = 0.055;
const SWIPE_THRESHOLD_PX = 95;
const SWIPE_COOLDOWN_MS = 650;
const OPEN_HAND_PULL_DISTANCE_PX = 210;
const HAND_SMOOTHING = 0.35;

const video = document.getElementById("webcam");
const canvas = document.getElementById("effects");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const selectedEl = document.getElementById("selected");
const commandBox = document.getElementById("commandBox");
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
let lastSwipeAt = 0;
let neighborCursor = 0;
let smoothedHands = [];
const trails = [];

function resize() {
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

async function fetchGraphJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load graph JSON: ${response.status}`);
  return graphifyToCytoscape(await response.json());
}

async function loadGraph() {
  const params = new URLSearchParams(window.location.search);
  const graphUrl = params.get("graphUrl");

  if (graphUrl) {
    statusEl.textContent = "Loading graph JSON from URL...";
    return fetchGraphJson(graphUrl);
  }

  try {
    const elements = await fetchGraphJson("/graph.json");
    statusEl.textContent = "Loaded public/graph.json.";
    return elements;
  } catch {
    statusEl.textContent = "No public/graph.json found; using the built-in demo graph.";
    return graphifyToCytoscape(null);
  }
}

function replaceGraph(elements) {
  cy.elements().remove();
  cy.add(elements);
  cy.layout({ name: "cose", animate: true, fit: true, padding: 70 }).run();
  grabbedNode = null;
  selectedNode = null;
  neighborCursor = 0;
  selectedEl.textContent = "Selected: none";
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function initForms() {
  githubForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = githubUrlInput.value.trim();
    if (!url) return;
    const command = `./start-mac.sh ${shellQuote(url)}`;
    commandBox.textContent = command;
    statusEl.textContent = "Local Mac command copied. Stop Vite, paste it in Terminal, and Graphify will build the repo graph.";
    navigator.clipboard?.writeText(command).catch(() => {
      statusEl.textContent = "Copy failed, but the local Mac command is shown in the command box.";
    });
  });

  commandBox?.addEventListener("click", () => {
    const command = commandBox.textContent.trim();
    navigator.clipboard?.writeText(command).then(() => {
      statusEl.textContent = "Command copied to clipboard.";
    });
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
    layout: { name: "cose", animate: true, fit: true, padding: 70 },
    style: [
      {
        selector: "node",
        style: {
          "background-color": "#78d7ff",
          "border-width": 2,
          "border-color": "#ffffff",
          label: "data(label)",
          "font-size": 11,
          color: "#ffffff",
          "text-outline-color": "#07111f",
          "text-outline-width": 3,
          width: 30,
          height: 30,
          "overlay-opacity": 0
        }
      },
      {
        selector: "node.activeHand",
        style: {
          "background-color": "#ffdc73",
          "border-color": "#fff8cf",
          width: 44,
          height: 44,
          "font-size": 14,
          "z-index": 10
        }
      },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "line-color": "rgba(200,230,255,0.34)",
          "target-arrow-shape": "triangle",
          "target-arrow-color": "rgba(200,230,255,0.48)",
          width: 1.6
        }
      }
    ],
    minZoom: 0.08,
    maxZoom: 4
  });

  cy.on("tap", "node", (event) => selectNode(event.target));
}

function selectNode(node) {
  if (!node) return;
  cy.nodes().removeClass("activeHand");
  selectedNode = node;
  node.addClass("activeHand");
  neighborCursor = 0;
  selectedEl.textContent = `Selected: ${node.data("label") || node.id()}`;
}

function screenToGraphPoint(x, y) {
  const pan = cy.pan();
  const zoom = cy.zoom();
  return { x: (x - pan.x) / zoom, y: (y - pan.y) / zoom };
}

function nearestNode(x, y) {
  const point = screenToGraphPoint(x, y);
  let best = null;
  let bestDistance = Infinity;
  cy.nodes().forEach((node) => {
    const position = node.position();
    const distance = Math.hypot(position.x - point.x, position.y - point.y);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  });
  return best;
}

function toScreenPoint(landmark) {
  return {
    x: (1 - landmark.x) * canvas.clientWidth,
    y: landmark.y * canvas.clientHeight
  };
}

function pinchPoint(hand) {
  const thumb = hand[4];
  const index = hand[8];
  const x = (1 - (thumb.x + index.x) / 2) * canvas.clientWidth;
  const y = ((thumb.y + index.y) / 2) * canvas.clientHeight;
  const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  return { x, y, pinched: distance < PINCH_THRESHOLD, distance };
}

function palmCenter(hand) {
  const ids = [0, 5, 9, 13, 17];
  const average = ids.reduce(
    (acc, id) => ({ x: acc.x + hand[id].x, y: acc.y + hand[id].y }),
    { x: 0, y: 0 }
  );
  return {
    x: (1 - average.x / ids.length) * canvas.clientWidth,
    y: (average.y / ids.length) * canvas.clientHeight
  };
}

function smoothLandmarks(hands) {
  smoothedHands = hands.map((hand, handIndex) => {
    const previous = smoothedHands[handIndex];
    if (!previous) return hand.map((landmark) => ({ ...landmark }));
    return hand.map((landmark, landmarkIndex) => ({
      ...landmark,
      x: previous[landmarkIndex].x + (landmark.x - previous[landmarkIndex].x) * HAND_SMOOTHING,
      y: previous[landmarkIndex].y + (landmark.y - previous[landmarkIndex].y) * HAND_SMOOTHING,
      z: previous[landmarkIndex].z + (landmark.z - previous[landmarkIndex].z) * HAND_SMOOTHING
    }));
  });
  return smoothedHands;
}

function drawStringEffects(hands) {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  hands.forEach((hand) => {
    const wrist = palmCenter(hand);
    const tips = [4, 8, 12, 16, 20].map((id) => toScreenPoint(hand[id]));

    tips.forEach((tip) => {
      trails.push({ x1: wrist.x, y1: wrist.y, x2: tip.x, y2: tip.y, life: 1 });
    });
  });

  while (trails.length > 180) trails.shift();

  for (let i = trails.length - 1; i >= 0; i -= 1) {
    const trail = trails[i];
    ctx.globalAlpha = trail.life;
    ctx.lineWidth = 1.5 + 4 * trail.life;
    ctx.beginPath();
    ctx.moveTo(trail.x1, trail.y1);
    const midX = (trail.x1 + trail.x2) / 2;
    const midY = (trail.y1 + trail.y2) / 2 - 32 * trail.life;
    ctx.quadraticCurveTo(midX, midY, trail.x2, trail.y2);
    ctx.strokeStyle = "rgba(140, 220, 255, 0.92)";
    ctx.shadowColor = "rgba(120, 215, 255, 0.65)";
    ctx.shadowBlur = 10;
    ctx.stroke();
    trail.life -= 0.04;
    if (trail.life <= 0) trails.splice(i, 1);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function traverseNeighbor(direction) {
  if (!selectedNode) return;
  const neighbors = selectedNode.connectedEdges().connectedNodes().difference(selectedNode);
  if (!neighbors.length) return;

  neighborCursor = (neighborCursor + (direction > 0 ? 1 : -1) + neighbors.length) % neighbors.length;
  const next = neighbors[neighborCursor];
  selectNode(next);
  cy.animate({ center: { eles: next }, zoom: Math.max(cy.zoom(), 1.1) }, { duration: 260 });
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

  // One-hand pinch: grab nearest node and move it with the smoothed pinch point.
  if (primary.pinched && hands.length === 1) {
    if (!grabbedNode) {
      grabbedNode = nearestNode(primary.x, primary.y);
      selectNode(grabbedNode);
    }
    const target = screenToGraphPoint(primary.x, primary.y);
    const current = grabbedNode.position();
    grabbedNode.position({
      x: current.x + (target.x - current.x) * 0.55,
      y: current.y + (target.y - current.y) * 0.55
    });
  } else if (hands.length === 1) {
    grabbedNode = null;
  }

  if (hands.length >= 2) {
    const a = pinches[0];
    const b = pinches[1];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    // Two-hand pinch distance: zoom around the midpoint.
    if (a.pinched && b.pinched) {
      if (lastTwoHandDistance) {
        const ratio = distance / lastTwoHandDistance;
        if (Math.abs(1 - ratio) > 0.015) {
          cy.zoom({
            level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * ratio)),
            renderedPosition: midpoint
          });
        }
      }
      lastTwoHandDistance = distance;
    } else {
      lastTwoHandDistance = null;
    }

    // Two open hands close together: pull selected node toward the midpoint.
    if (!a.pinched && !b.pinched && distance < OPEN_HAND_PULL_DISTANCE_PX && selectedNode) {
      const target = screenToGraphPoint(midpoint.x, midpoint.y);
      const current = selectedNode.position();
      selectedNode.position({
        x: current.x + (target.x - current.x) * 0.18,
        y: current.y + (target.y - current.y) * 0.18
      });
    }
  }

  // Right-most visible hand horizontal swipe: jump among connected neighbor nodes.
  const rightMostHand = hands.reduce((rightMost, hand) => (palmCenter(hand).x > palmCenter(rightMost).x ? hand : rightMost), hands[0]);
  const rightPalm = palmCenter(rightMostHand);
  const now = performance.now();
  if (lastRightX !== null && selectedNode && now - lastSwipeAt > SWIPE_COOLDOWN_MS) {
    const deltaX = rightPalm.x - lastRightX;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
      traverseNeighbor(Math.sign(deltaX));
      lastSwipeAt = now;
    }
  }
  lastRightX = rightPalm.x;
}

async function setupCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera APIs are unavailable in this browser. Use a modern browser on localhost or HTTPS.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

async function setupHands() {
  const vision = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
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
    const hands = smoothLandmarks(result.landmarks || []);
    drawStringEffects(hands);
    handleGestures(hands);
    statusEl.textContent = hands.length
      ? `${hands.length} hand(s) tracked. Pinch, zoom, pull, or swipe to navigate.`
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
