function normalizeCytoscapeElements(elements) {
  if (Array.isArray(elements)) {
    return elements.map((element) => (element.data ? element : { data: element }));
  }

  if (elements && typeof elements === "object") {
    return [...(elements.nodes || []), ...(elements.edges || [])].map((element) =>
      element.data ? element : { data: element }
    );
  }

  return [];
}

function asArrayOrObjectValues(candidate) {
  if (!candidate) return [];
  if (Array.isArray(candidate)) return candidate;
  return Object.entries(candidate).map(([id, data]) => ({
    id,
    ...(data && typeof data === "object" ? data : { label: String(data) })
  }));
}

export function graphifyToCytoscape(raw) {
  if (!raw) return demoGraph();

  // Already Cytoscape-like: either an element array or { elements: { nodes, edges } }.
  if (raw.elements) {
    const normalized = normalizeCytoscapeElements(raw.elements);
    return normalized.length ? normalized : demoGraph();
  }

  const nodes = asArrayOrObjectValues(raw.nodes || raw.vertices || raw.concepts || raw.entities);
  const edgeCandidates = raw.links || raw.edges || raw.relationships || raw.relations || [];
  const edges = Array.isArray(edgeCandidates)
    ? edgeCandidates
    : Object.entries(edgeCandidates).flatMap(([source, targets]) => {
        if (Array.isArray(targets)) return targets.map((target) => ({ source, target }));
        if (targets && typeof targets === "object") {
          return Object.keys(targets).map((target) => ({ source, target, ...targets[target] }));
        }
        return [];
      });

  const cyNodes = nodes.map((node, index) => {
    const id = String(node.id ?? node.name ?? node.key ?? node.uid ?? `n${index}`);
    return {
      group: "nodes",
      data: {
        ...node,
        id,
        label: String(node.label ?? node.name ?? node.title ?? id).slice(0, 42),
        kind: String(node.kind ?? node.type ?? node.file_type ?? node.group ?? "node")
      }
    };
  });

  const knownIds = new Set(cyNodes.map((node) => node.data.id));
  const cyEdges = edges
    .map((edge, index) => {
      const source = String(edge.source ?? edge.from ?? edge.src ?? "");
      const target = String(edge.target ?? edge.to ?? edge.dst ?? "");
      if (!knownIds.has(source) || !knownIds.has(target)) return null;
      return {
        group: "edges",
        data: {
          ...edge,
          id: String(edge.id ?? `${source}__${target}__${index}`),
          source,
          target,
          label: String(edge.label ?? edge.type ?? edge.relation ?? edge.relationship ?? "")
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
