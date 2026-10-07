import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, Cpu, Eye, HardDrive, Link2, Loader2, Network, Pencil, Plus, RefreshCw, Server, Trash2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import type { NetworkLink, NetworkNode, NetworkNodeStatus, NetworkStatus, NetworkTopology, OkResponse } from "@/lib/types";
import { errorMessage } from "@/lib/hub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import NetworkLinkDialog from "@/components/network/NetworkLinkDialog";
import NetworkNodeDialog from "@/components/network/NetworkNodeDialog";
import NetworkPortsDialog from "@/components/network/NetworkPortsDialog";
import NetworkTopologyView from "@/components/network/NetworkTopology";
import { NETWORK_NODE_TYPE_LABELS, networkStatusStyle } from "@/components/network/network-constants";
import { cn } from "@/lib/utils";

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: typeof Network; tone: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[.14em] text-slate-500">{label}</span><Icon className={cn("size-4", tone)} /></div><div className="mt-1 font-heading text-2xl font-semibold text-white">{value}</div></div>;
}

export default function NetworkManager() {
  const qc = useQueryClient();
  const [view, setView] = useState<"noc" | "inventory">("noc");
  const [nodeDialog, setNodeDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<NetworkNode | null>(null);
  const [linkDialog, setLinkDialog] = useState(false);
  const [editingLink, setEditingLink] = useState<NetworkLink | null>(null);
  const [portsNode, setPortsNode] = useState<NetworkNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  const topologyQ = useQuery({ queryKey: ["network-topology"], queryFn: () => apiGet<NetworkTopology>("/admin/network/topology"), retry: false });
  const statusQ = useQuery({ queryKey: ["network-status"], queryFn: () => apiGet<NetworkStatus>("/admin/network/status"), refetchInterval: 30_000, retry: false });
  const topology = topologyQ.data ?? { nodes: [], ports: [], links: [] };
  const statuses = useMemo<Record<string, NetworkNodeStatus>>(
    () => Object.fromEntries((statusQ.data?.nodes ?? []).map((status) => [status.node_id, status])),
    [statusQ.data],
  );
  const nodeById = useMemo(() => Object.fromEntries(topology.nodes.map((node) => [node.id, node])), [topology.nodes]);
  const portById = useMemo(() => Object.fromEntries(topology.ports.map((port) => [port.id, port])), [topology.ports]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["network-topology"] });
    qc.invalidateQueries({ queryKey: ["network-status"] });
  };

  const moveNode = useMutation({
    mutationFn: ({ node, position }: { node: NetworkNode; position: { position_x: number; position_y: number } }) => apiPatch<NetworkNode>(`/admin/network/nodes/${node.id}/position`, position),
    onSuccess: (node) => {
      qc.setQueryData<NetworkTopology>(["network-topology"], (current) => current ? { ...current, nodes: current.nodes.map((item) => item.id === node.id ? node : item) } : current);
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar a posição")),
  });

  const removeNode = useMutation({
    mutationFn: (id: string) => apiDelete<OkResponse>(`/admin/network/nodes/${id}`),
    onSuccess: () => { toast.success("Equipamento removido"); setSelectedNode(null); invalidate(); },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível remover o equipamento")),
  });

  const removeLink = useMutation({
    mutationFn: (id: string) => apiDelete<OkResponse>(`/admin/network/links/${id}`),
    onSuccess: () => { toast.success("Enlace removido"); invalidate(); },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível remover o enlace")),
  });

  const nodes = topology.nodes;
  const liveStatuses = statusQ.data?.nodes ?? [];
  const online = liveStatuses.filter((item) => item.status === "online").length;
  const offline = liveStatuses.filter((item) => item.status === "offline").length;
  const unknown = nodes.length - online - offline;

  const openNewNode = () => { setEditingNode(null); setNodeDialog(true); };
  const openNewLink = () => {
    if (nodes.length < 2) { toast.error("Cadastre pelo menos dois equipamentos antes de criar um enlace"); return; }
    setEditingLink(null);
    setLinkDialog(true);
  };

  if (topologyQ.isLoading) return <div className="flex h-48 items-center justify-center gap-2 text-slate-400"><Loader2 className="size-4 animate-spin" /> Carregando o inventário de rede…</div>;

  return (
    <div className="space-y-6" data-testid="network-manager">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><Network className="size-5 text-sky-400" /><h2 className="font-heading text-2xl font-semibold tracking-tight text-white">Mapa de rede</h2><Badge variant="outline" className="border-sky-500/30 text-sky-300">NOC</Badge></div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Documente a topologia, acompanhe a disponibilidade e mantenha as portas identificadas por comentários.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => statusQ.refetch()} className="gap-1.5"><RefreshCw className={cn("size-4", statusQ.isFetching && "animate-spin")} /> Atualizar NOC</Button>
          <Button size="sm" onClick={openNewNode} className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500"><Plus className="size-4" /> Equipamento</Button>
          <Button size="sm" variant="outline" onClick={openNewLink} className="gap-1.5"><Link2 className="size-4" /> Enlace</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
        <button type="button" data-testid="network-view-noc" onClick={() => setView("noc")} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors", view === "noc" ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:text-slate-200")}><Eye className="size-4" /> NOC e topologia</button>
        <button type="button" data-testid="network-view-inventory" onClick={() => setView("inventory")} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors", view === "inventory" ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:text-slate-200")}><HardDrive className="size-4" /> Inventário e enlaces</button>
      </div>

      {statusQ.isError && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">O inventário está disponível, mas a última sondagem do NOC não pôde ser concluída. Verifique o servidor e o comando ping.</div>}

      {view === "noc" ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Equipamentos" value={nodes.length} icon={Cpu} tone="text-sky-400" />
            <Stat label="Online" value={online} icon={Wifi} tone="text-emerald-400" />
            <Stat label="Offline" value={offline} icon={WifiOff} tone="text-red-400" />
            <Stat label="Sem dados" value={Math.max(unknown, 0)} icon={Server} tone="text-amber-400" />
          </div>
          <NetworkTopologyView topology={topology} statuses={statuses} editable onMove={(node, position) => moveNode.mutate({ node, position })} onSelect={setSelectedNode} selectedNodeId={selectedNode?.id ?? null} />
          {selectedNode && (
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><h3 className="font-heading text-lg font-semibold text-white">{selectedNode.name}</h3><Badge variant="outline" className="border-slate-700 text-slate-300">{NETWORK_NODE_TYPE_LABELS[selectedNode.node_type]}</Badge></div><p className="mt-1 text-sm text-slate-400">{selectedNode.description || "Sem descrição"} {selectedNode.host && <span className="font-mono text-sky-300">· {selectedNode.host}</span>}</p></div>
                <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setEditingNode(selectedNode); setNodeDialog(true); }} className="gap-1.5"><Pencil className="size-4" /> Editar</Button><Button variant="outline" size="sm" onClick={() => setPortsNode(selectedNode)} className="gap-1.5"><Cable className="size-4" /> Portas</Button></div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.5fr]">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="text-[11px] uppercase tracking-[.16em] text-slate-500">Status atual</div>{(() => { const status = statuses[selectedNode.id] ?? { status: "unknown" as const, protocol: selectedNode.monitor_protocol, latency_ms: null, error: null, node_id: selectedNode.id, checked_at: null }; const style = networkStatusStyle(status.status); return <div className={cn("mt-2 flex items-center gap-2 text-sm", style.color)}><span className={cn("size-2 rounded-full", style.dot)} />{style.text}{status.latency_ms !== null && <span className="font-mono text-xs text-slate-400">{status.latency_ms} ms</span>}{status.error && <span className="truncate text-xs text-slate-500">· {status.error}</span>}</div>; })()}</div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="text-[11px] uppercase tracking-[.16em] text-slate-500">Notas operacionais</div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{selectedNode.notes || "Nenhuma nota cadastrada."}</p></div>
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3"><div><h3 className="font-heading font-semibold text-white">Equipamentos cadastrados</h3><p className="text-xs text-slate-500">Clique em Portas para identificar interfaces e comentários.</p></div><Button size="sm" onClick={openNewNode} className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500"><Plus className="size-4" /> Novo equipamento</Button></div>
            {nodes.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Nenhum equipamento cadastrado.</div> : <div className="divide-y divide-slate-800">{nodes.map((node) => { const status = statuses[node.id]; const style = networkStatusStyle(status?.status ?? "unknown"); const nodePorts = topology.ports.filter((port) => port.node_id === node.id); return <div key={node.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><span className={cn("size-2 rounded-full", style.dot)} title={style.text} /><div className="min-w-40 flex-1"><div className="flex items-center gap-2"><span className="font-medium text-white">{node.name}</span><Badge variant="secondary" className="text-[10px]">{NETWORK_NODE_TYPE_LABELS[node.node_type]}</Badge></div><div className="mt-0.5 font-mono text-xs text-slate-500">{node.host || "sem monitoramento"} · {node.monitor_protocol.toUpperCase()}</div></div><span className="text-xs text-slate-500">{nodePorts.length} porta{nodePorts.length === 1 ? "" : "s"}</span><Button variant="ghost" size="sm" onClick={() => setPortsNode(node)} className="gap-1.5"><Cable className="size-4" /> Portas</Button><Button variant="ghost" size="icon-sm" aria-label={`Editar ${node.name}`} onClick={() => { setEditingNode(node); setNodeDialog(true); }}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Excluir ${node.name}`} className="text-red-400 hover:text-red-300" onClick={() => { if (window.confirm(`Excluir ${node.name}? Os enlaces e portas associados também serão removidos.`)) removeNode.mutate(node.id); }}><Trash2 className="size-4" /></Button></div>; })}</div>}
          </section>
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3"><div><h3 className="font-heading font-semibold text-white">Enlaces da topologia</h3><p className="text-xs text-slate-500">A origem e o destino podem apontar para portas documentadas.</p></div><Button size="sm" variant="outline" onClick={openNewLink} className="gap-1.5"><Plus className="size-4" /> Novo enlace</Button></div>
            {topology.links.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Nenhum enlace cadastrado.</div> : <div className="divide-y divide-slate-800">{topology.links.map((link) => { const sourcePort = link.source_port_id ? portById[link.source_port_id] : null; const targetPort = link.target_port_id ? portById[link.target_port_id] : null; return <div key={link.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><span className={cn("size-2 rounded-full", link.enabled ? "bg-sky-400" : "bg-slate-600")} /><div className="min-w-48 flex-1"><div className="flex items-center gap-2 font-medium text-white"><span>{nodeById[link.source_node_id]?.name ?? "Origem removida"}</span><span className="text-slate-600">↔</span><span>{nodeById[link.target_node_id]?.name ?? "Destino removido"}</span></div><div className="mt-0.5 text-xs text-slate-500">{sourcePort?.name ?? "sem porta"} ↔ {targetPort?.name ?? "sem porta"}{link.label && ` · ${link.label}`}{link.comment && ` · ${link.comment}`}</div></div><Badge variant="outline" className="border-slate-700 text-slate-400">{link.link_type}</Badge><Button variant="ghost" size="icon-sm" aria-label="Editar enlace" onClick={() => { setEditingLink(link); setLinkDialog(true); }}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label="Excluir enlace" className="text-red-400 hover:text-red-300" onClick={() => { if (window.confirm("Excluir este enlace?")) removeLink.mutate(link.id); }}><Trash2 className="size-4" /></Button></div>; })}</div>}
          </section>
        </div>
      )}

      <NetworkNodeDialog open={nodeDialog} onOpenChange={setNodeDialog} node={editingNode} onSaved={invalidate} />
      <NetworkLinkDialog open={linkDialog} onOpenChange={setLinkDialog} link={editingLink} nodes={topology.nodes} ports={topology.ports} onSaved={invalidate} />
      <NetworkPortsDialog open={Boolean(portsNode)} onOpenChange={(open) => { if (!open) setPortsNode(null); }} node={portsNode} ports={portsNode ? topology.ports.filter((port) => port.node_id === portsNode.id) : []} onSaved={invalidate} />
    </div>
  );
}
