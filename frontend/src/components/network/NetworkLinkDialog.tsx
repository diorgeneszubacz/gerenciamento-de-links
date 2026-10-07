import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import type { NetworkLink, NetworkLinkIn, NetworkLinkType, NetworkNode, NetworkPort } from "@/lib/types";
import { errorMessage } from "@/lib/hub";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: NetworkLink | null;
  nodes: NetworkNode[];
  ports: NetworkPort[];
  onSaved: () => void;
}

const blank: NetworkLinkIn = {
  source_node_id: "",
  target_node_id: "",
  source_port_id: null,
  target_port_id: null,
  label: "",
  link_type: "ethernet",
  comment: "",
  enabled: true,
};

const linkTypes: Array<[NetworkLinkType, string]> = [
  ["ethernet", "Ethernet / cobre"],
  ["fiber", "Fibra óptica"],
  ["wireless", "Wireless"],
  ["logical", "Lógico"],
  ["other", "Outro"],
];

export default function NetworkLinkDialog({ open, onOpenChange, link, nodes, ports, onSaved }: Props) {
  const [form, setForm] = useState<NetworkLinkIn>(blank);

  useEffect(() => {
    if (!open) return;
    if (link) {
      const { id: _id, created_at: _created, ...rest } = link;
      setForm(rest);
    } else {
      setForm({ ...blank, source_node_id: nodes[0]?.id ?? "", target_node_id: nodes[1]?.id ?? "" });
    }
  }, [open, link, nodes]);

  const set = <K extends keyof NetworkLinkIn>(key: K, value: NetworkLinkIn[K]) => setForm((current) => ({ ...current, [key]: value }));
  const sourcePorts = useMemo(() => ports.filter((port) => port.node_id === form.source_node_id), [ports, form.source_node_id]);
  const targetPorts = useMemo(() => ports.filter((port) => port.node_id === form.target_node_id), [ports, form.target_node_id]);
  const nodeLabel = Object.fromEntries(nodes.map((node) => [node.id, node.name]));

  const save = useMutation({
    mutationFn: (body: NetworkLinkIn) => link ? apiPut<NetworkLink>(`/admin/network/links/${link.id}`, body) : apiPost<NetworkLink>("/admin/network/links", body),
    onSuccess: () => {
      toast.success(link ? "Enlace atualizado" : "Enlace criado");
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar o enlace")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" data-testid="network-link-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{link ? "Editar enlace" : "Novo enlace"}</DialogTitle>
          <DialogDescription>Conecte dois equipamentos e documente o caminho físico ou lógico.</DialogDescription>
        </DialogHeader>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save.mutate(form); }}>
          <div className="space-y-2">
            <Label htmlFor="network-link-source">Origem</Label>
            <select id="network-link-source" value={form.source_node_id} onChange={(event) => setForm((current) => ({ ...current, source_node_id: event.target.value, source_port_id: null }))} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30" required>
              <option value="" className="bg-slate-900">Selecione</option>
              {nodes.map((node) => <option key={node.id} value={node.id} className="bg-slate-900">{node.name}{node.host ? ` · ${node.host}` : ""}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-link-source-port">Porta de origem</Label>
            <select id="network-link-source-port" value={form.source_port_id ?? ""} onChange={(event) => set("source_port_id", event.target.value || null)} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
              <option value="" className="bg-slate-900">Não especificada</option>
              {sourcePorts.map((port) => <option key={port.id} value={port.id} className="bg-slate-900">{port.name}{port.comment ? ` · ${port.comment}` : ""}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-link-target">Destino</Label>
            <select id="network-link-target" value={form.target_node_id} onChange={(event) => setForm((current) => ({ ...current, target_node_id: event.target.value, target_port_id: null }))} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30" required>
              <option value="" className="bg-slate-900">Selecione</option>
              {nodes.map((node) => <option key={node.id} value={node.id} className="bg-slate-900">{node.name}{node.host ? ` · ${node.host}` : ""}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-link-target-port">Porta de destino</Label>
            <select id="network-link-target-port" value={form.target_port_id ?? ""} onChange={(event) => set("target_port_id", event.target.value || null)} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
              <option value="" className="bg-slate-900">Não especificada</option>
              {targetPorts.map((port) => <option key={port.id} value={port.id} className="bg-slate-900">{port.name}{port.comment ? ` · ${port.comment}` : ""}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-link-type">Tipo de enlace</Label>
            <select id="network-link-type" value={form.link_type} onChange={(event) => set("link_type", event.target.value as NetworkLinkType)} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
              {linkTypes.map(([value, label]) => <option key={value} value={value} className="bg-slate-900">{label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-link-label">Rótulo no mapa</Label>
            <Input id="network-link-label" value={form.label} onChange={(event) => set("label", event.target.value)} placeholder={`${nodeLabel[form.source_node_id] ?? "Origem"} ↔ ${nodeLabel[form.target_node_id] ?? "Destino"}`} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="network-link-comment">Comentário operacional</Label>
            <Textarea id="network-link-comment" rows={3} value={form.comment} onChange={(event) => set("comment", event.target.value)} placeholder="Ex.: uplink trunk, fibra 12FO, circuito da operadora…" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
            <Checkbox checked={form.enabled} onCheckedChange={(checked) => set("enabled", Boolean(checked))} />
            Exibir este enlace no mapa
          </label>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" data-testid="network-link-save-btn" disabled={save.isPending || nodes.length < 2} className="bg-sky-600 text-white hover:bg-sky-500">
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar enlace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
