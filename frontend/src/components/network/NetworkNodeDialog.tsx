import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import type { MonitorProtocol, NetworkNode, NetworkNodeIn, NetworkNodeType, NetworkZone } from "@/lib/types";
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
  node: NetworkNode | null;
  zones: NetworkZone[];
  onSaved: () => void;
}

const blank: NetworkNodeIn = {
  name: "",
  zone_id: null,
  node_type: "switch",
  description: "",
  host: "",
  monitor_protocol: "icmp",
  monitor_port: null,
  monitor_path: "/",
  position_x: 50,
  position_y: 50,
  enabled: true,
  notes: "",
};

const nodeTypes: Array<[NetworkNodeType, string]> = [
  ["cloud", "Nuvem / Internet"],
  ["router", "Roteador"],
  ["switch", "Switch"],
  ["firewall", "Firewall"],
  ["server", "Servidor"],
  ["computer", "Computador"],
  ["access_point", "Access point"],
  ["patch_panel", "Patch panel"],
  ["printer", "Impressora"],
  ["camera", "Câmera IP"],
  ["phone", "Telefone IP"],
  ["database", "Banco de dados"],
  ["nas", "NAS / Storage"],
  ["ups", "UPS"],
  ["other", "Outro"],
];

const protocols: Array<[MonitorProtocol, string]> = [
  ["icmp", "ICMP ping"],
  ["tcp", "TCP"],
  ["http", "HTTP/HTTPS"],
  ["none", "Sem monitoramento"],
];

export default function NetworkNodeDialog({ open, onOpenChange, node, zones, onSaved }: Props) {
  const [form, setForm] = useState<NetworkNodeIn>(blank);

  useEffect(() => {
    if (!open) return;
    if (node) {
      const { id: _id, created_at: _created, updated_at: _updated, ...rest } = node;
      setForm({ ...rest, host: rest.host ?? "", notes: rest.notes ?? "" });
    } else {
      setForm({ ...blank });
    }
  }, [open, node]);

  const set = <K extends keyof NetworkNodeIn>(key: K, value: NetworkNodeIn[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: (body: NetworkNodeIn) => node ? apiPut<NetworkNode>(`/admin/network/nodes/${node.id}`, body) : apiPost<NetworkNode>("/admin/network/nodes", body),
    onSuccess: () => {
      toast.success(node ? "Equipamento atualizado" : "Equipamento adicionado");
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar o equipamento")),
  });

  const submit = () => {
    save.mutate({
      ...form,
      name: form.name.trim(),
      host: form.host?.trim() || null,
      monitor_port: ["tcp", "http"].includes(form.monitor_protocol) ? form.monitor_port : null,
      monitor_path: form.monitor_path.trim() || "/",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" data-testid="network-node-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{node ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
          <DialogDescription>Cadastre o ativo, escolha a sonda e use as notas para documentar a infraestrutura.</DialogDescription>
        </DialogHeader>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="space-y-2">
            <Label htmlFor="network-node-name">Nome</Label>
            <Input id="network-node-name" data-testid="network-node-name-input" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Ex.: SW-CORE-01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-node-type">Tipo</Label>
            <select id="network-node-type" value={form.node_type} onChange={(event) => set("node_type", event.target.value as NetworkNodeType)} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
              {nodeTypes.map(([value, label]) => <option key={value} value={value} className="bg-slate-900">{label}</option>)}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="network-node-description">Descrição curta</Label>
            <Input id="network-node-description" value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="Função, local ou rack" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-node-zone">Rede / segmento</Label>
            <select id="network-node-zone" value={form.zone_id ?? ""} onChange={(event) => set("zone_id", event.target.value || null)} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
              <option value="" className="bg-slate-900">Sem rede definida</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id} className="bg-slate-900">{zone.name} · {zone.cidr}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-node-host">Host ou IP</Label>
            <Input id="network-node-host" data-testid="network-node-host-input" value={form.host ?? ""} onChange={(event) => set("host", event.target.value)} placeholder="192.168.1.1 ou core.local" className="font-mono" disabled={form.monitor_protocol === "none"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-node-protocol">Protocolo de monitoramento</Label>
            <select id="network-node-protocol" data-testid="network-node-protocol-select" value={form.monitor_protocol} onChange={(event) => set("monitor_protocol", event.target.value as MonitorProtocol)} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
              {protocols.map(([value, label]) => <option key={value} value={value} className="bg-slate-900">{label}</option>)}
            </select>
          </div>
          {form.monitor_protocol === "tcp" || form.monitor_protocol === "http" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="network-node-port">Porta</Label>
                <Input id="network-node-port" type="number" min={1} max={65535} value={form.monitor_port ?? ""} onChange={(event) => set("monitor_port", event.target.value ? Number(event.target.value) : null)} className="font-mono" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="network-node-path">Caminho HTTP</Label>
                <Input id="network-node-path" value={form.monitor_path} onChange={(event) => set("monitor_path", event.target.value)} className="font-mono" disabled={form.monitor_protocol !== "http"} />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400 md:col-span-2">
              {form.monitor_protocol === "icmp" ? "O servidor fará um ping ICMP a cada atualização do NOC." : "Este ativo ficará documentado no mapa, mas não será sondado automaticamente."}
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="network-node-notes">Notas operacionais</Label>
            <Textarea id="network-node-notes" rows={4} value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Rack, circuito, fornecedor, VLANs, observações de manutenção…" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
            <Checkbox checked={form.enabled} onCheckedChange={(checked) => set("enabled", Boolean(checked))} />
            Ativo no monitoramento
          </label>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" data-testid="network-node-save-btn" disabled={save.isPending} className="bg-sky-600 text-white hover:bg-sky-500">
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar equipamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
