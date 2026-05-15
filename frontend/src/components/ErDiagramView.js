import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ER diagram viewer (React Flow + dagre layout).
 */
import { useEffect, useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, useEdgesState, useNodesState, MarkerType, } from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
function layoutDagre(nodes, edges) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100 });
    for (const n of nodes) {
        g.setNode(n.id, { width: 180, height: 56 });
    }
    for (const e of edges) {
        g.setEdge(e.source, e.target);
    }
    dagre.layout(g);
    return nodes.map((n) => {
        const p = g.node(n.id);
        return {
            ...n,
            position: { x: p.x - 90, y: p.y - 28 },
        };
    });
}
export function ErDiagramView({ data }) {
    const builtNodes = useMemo(() => data.nodes.map((n) => ({
        id: n.id,
        data: { label: n.label },
        position: { x: 0, y: 0 },
        style: {
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
            fontSize: 12,
            width: 180,
        },
    })), [data.nodes]);
    const builtEdges = useMemo(() => data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        markerEnd: { type: MarkerType.ArrowClosed },
    })), [data.edges]);
    const [nodes, setNodes, onNodesChange] = useNodesState(layoutDagre(builtNodes, builtEdges));
    const [edges, setEdges, onEdgesChange] = useEdgesState(builtEdges);
    useEffect(() => {
        setEdges(builtEdges);
        setNodes(layoutDagre(builtNodes, builtEdges));
    }, [builtNodes, builtEdges, setNodes, setEdges]);
    return (_jsx("div", { className: "border-border bg-surface-elevated flex h-[480px] flex-col rounded border", children: _jsx("div", { className: "min-h-0 flex-1", children: _jsxs(ReactFlow, { nodes: nodes, edges: edges, onNodesChange: onNodesChange, onEdgesChange: onEdgesChange, fitView: true, children: [_jsx(MiniMap, {}), _jsx(Controls, {}), _jsx(Background, {})] }) }) }));
}
