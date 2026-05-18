export function graphifyToCytoscape(raw) {
  if (!raw) return demoGraph();

  // Already Cytoscape-like.
  if (Array.isArray(raw.elements)) {
    return raw.elements.map((el) => {
      if (el.data) return el;
      return { data: el };
    });
  }

  const nodeCandidates = raw.nodes || raw.vertices || raw.concepts || raw.entities || [];
  const edgeCandidates = raw.edges || raw.links || raw.relationships || raw.relations || [];

  const nodes = Array.isArray(nodeCandidates)
    ? nodeCandidates
    : Object.entries(nodeCandidates).map(([id, data]) => ({ id, ...(typeof data === "object" ? data : { label: String(data) }) }));

  const edges = Array.isArray(edgeCandidates)
    ? edgeCandidates
    : Object.entries(edgeCandidates).flatMap(([source, targets]) => {
        if (Array.isArray(targets)) return targets.map((target) => ({ source, target }));
        return [];
      });

  const cyNodes = nodes.map((n, index) => {
    const id = String(n.id || n.name || n.key || n.uid || `n${index}`);
    return {
      group: "nodes",
      data: {
        ...n,
        id,
        label: String(n.label || n.name || n.title || n.kind || id).slice(0, 42),
        kind: String(n.kind || n.type || n.group || "node")
      }
    };
  });

  const knownIds = new Set(cyNodes.map((n) => n.data.id));
  const cyEdges = edges
    .map((e, index) => {
      const source = String(e.source || e.from || e.start || e.src || e.source_id || "");
      const target = String(e.target || e.to || e.end || e.dst || e.target_id || "");
      if (!knownIds.has(source) || !knownIds.has(target)) return null;
      return {
        group: "edges",
        data: {
          ...e,
          id: String(e.id || `${source}__${target}__${index}`),
          source,
          target,
          label: String(e.label || e.type || e.relation || "")
        }
      };
    })
    .filter(Boolean);

  return cyNodes.length ? [...cyNodes, ...cyEdges] : demoGraph();
}

export function demoGraph() {
  return [
    { data: { id: "graphify", label: "Graphify graph.json", kind: "root" } },
    { data: { id: "camera", label: "Real camera feed", kind: "input" } },
    { data: { id: "hands", label: "MediaPipe Hands", kind: "vision" } },
    { data: { id: "gestures", label: "Gesture engine", kind: "control" } },
    { data: { id: "nodes", label: "Node navigation", kind: "graph" } },
    { data: { id: "strings", label: "String effects", kind: "visual" } },
    { data: { id: "mac", label: "One-click Mac start", kind: "script" } },
    { data: { id: "e1", source: "graphify", target: "nodes", label: "loads" } },
    { data: { id: "e2", source: "camera", target: "hands", label: "tracks" } },
    { data: { id: "e3", source: "hands", target: "gestures", label: "landmarks" } },
    { data: { id: "e4", source: "gestures", target: "nodes", label: "controls" } },
    { data: { id: "e5", source: "hands", target: "strings", label: "draws" } },
    { data: { id: "e6", source: "mac", target: "graphify", label: "builds" } }
  ];
}
