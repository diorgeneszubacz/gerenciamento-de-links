import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { NetworkNode, NetworkNodeStatus, NetworkTopology as NetworkTopologyData } from "@/lib/types";
import { NETWORK_NODE_ICONS, NETWORK_NODE_TYPE_LABELS, networkStatusStyle } from "./network-constants";
import { cn } from "@/lib/utils";

interface Props {
  topology: NetworkTopologyData;
  statuses?: Record<string, NetworkNodeStatus>;
  editable?: boolean;
  selectedNodeId?: string | null;
  onMove?: (node: NetworkNode, position: { position_x: number; position_y: number }) => void;
  onSelect?: (node: NetworkNode) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function NetworkTopology({ topology, statuses = {}, editable = false, selectedNodeId, onMove, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({});
  const nodes = topology.nodes;
  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const portById = Object.fromEntries(topology.ports.map((port) => [port.id, port]));

  const positionOf = (node: NetworkNode) => draftPositions[node.id] ?? { x: node.position_x, y: node.position_y };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>, node: NetworkNode) => {
    if (!editable || !onMove) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: node.id, moved: false };
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>, node: NetworkNode) => {
    if (!dragRef.current || dragRef.current.id !== node.id || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 3, 97);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 7, 93);
    dragRef.current.moved = true;
    setDraftPositions((current) => ({ ...current, [node.id]: { x, y } }));
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>, node: NetworkNode) => {
    if (!dragRef.current || dragRef.current.id !== node.id) return;
    const moved = dragRef.current.moved;
    const draft = draftPositions[node.id];
    dragRef.current = null;
    justDraggedRef.current = moved;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (moved && draft && onMove) {
      onMove(node, { position_x: draft.x, position_y: draft.y });
    }
  };

  return (
    <div
      ref={mapRef}
      className="relative min-h-[500px] overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1221] shadow-inner shadow-black/30"
      data-testid="network-topology-map"
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(56,189,248,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,.09)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(14,165,233,.12),transparent_55%)]" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {topology.links.filter((link) => link.enabled).map((link) => {
          const source = nodeById[link.source_node_id];
          const target = nodeById[link.target_node_id];
          if (!source || !target) return null;
          const sourcePos = positionOf(source);
          const targetPos = positionOf(target);
          const color = link.link_type === "fiber" ? "#a78bfa" : link.link_type === "wireless" ? "#f59e0b" : "#38bdf8";
          const sourcePort = link.source_port_id ? portById[link.source_port_id]?.name : "";
          const targetPort = link.target_port_id ? portById[link.target_port_id]?.name : "";
          const label = link.label || [sourcePort, targetPort].filter(Boolean).join(" ↔ ");
          return (
            <g key={link.id}>
              <line x1={sourcePos.x} y1={sourcePos.y} x2={targetPos.x} y2={targetPos.y} stroke={color} strokeOpacity=".52" strokeWidth=".45" strokeDasharray={link.link_type === "wireless" ? "2 1" : undefined} />
              {label && <text x={(sourcePos.x + targetPos.x) / 2} y={(sourcePos.y + targetPos.y) / 2 - 1.3} fill="#94a3b8" fontSize="2.1" textAnchor="middle">{label.slice(0, 24)}</text>}
            </g>
          );
        })}
      </svg>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-slate-500">
          Adicione o primeiro equipamento para começar a desenhar sua infraestrutura.
        </div>
      )}

      {nodes.map((node) => {
        const pos = positionOf(node);
        const status = statuses[node.id] ?? { node_id: node.id, status: "unknown", protocol: node.monitor_protocol, latency_ms: null, error: null, checked_at: null };
        const style = networkStatusStyle(status.status);
        const Icon: LucideIcon = NETWORK_NODE_ICONS[node.node_type];
        const portCount = topology.ports.filter((port) => port.node_id === node.id).length;
        return (
          <div
            key={node.id}
            className="absolute z-10 w-44 -translate-x-1/2 -translate-y-1/2 touch-none"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onPointerDown={(event) => pointerDown(event, node)}
            onPointerMove={(event) => pointerMove(event, node)}
            onPointerUp={(event) => pointerUp(event, node)}
          >
            <button
              type="button"
              className={cn(
                "w-full rounded-xl border bg-[#131c31]/95 p-3 text-left shadow-lg shadow-black/25 transition-colors",
                selectedNodeId === node.id ? "border-sky-400 ring-2 ring-sky-400/20" : "border-slate-700 hover:border-slate-500",
                editable && "cursor-grab active:cursor-grabbing",
              )}
              onClick={() => { if (!justDraggedRef.current) onSelect?.(node); justDraggedRef.current = false; }}
              aria-label={`Equipamento ${node.name}`}
            >
              <div className="flex items-start gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-300"><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{node.name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-[.12em] text-slate-500">{NETWORK_NODE_TYPE_LABELS[node.node_type]}</span>
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                <span className={cn("flex items-center gap-1.5", style.color)}><span className={cn("size-1.5 rounded-full", style.dot)} />{style.text}</span>
                <span className="text-slate-500">{portCount} porta{portCount === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
                <span className="truncate">{node.host || "sem endereço"}</span>
                {status.latency_ms !== null && <span className="shrink-0">{status.latency_ms} ms</span>}
              </div>
            </button>
          </div>
        );
      })}

      {editable && <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-slate-500">Arraste os equipamentos para organizar o mapa</p>}
    </div>
  );
}
