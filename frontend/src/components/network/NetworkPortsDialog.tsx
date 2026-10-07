import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import type { NetworkNode, NetworkPort, NetworkPortIn, OkResponse } from "@/lib/types";
import { errorMessage } from "@/lib/hub";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: NetworkNode | null;
  ports: NetworkPort[];
  onSaved: () => void;
}

const blank: NetworkPortIn = { name: "", comment: "", vlan: "" };

export default function NetworkPortsDialog({ open, onOpenChange, node, ports, onSaved }: Props) {
  const [form, setForm] = useState<NetworkPortIn>(blank);
  const [editing, setEditing] = useState<NetworkPort | null>(null);

  useEffect(() => {
    if (open) {
      setEditing(null);
      setForm({ ...blank });
    }
  }, [open, node]);

  const save = useMutation({
    mutationFn: (body: NetworkPortIn) => editing ? apiPut<NetworkPort>(`/admin/network/ports/${editing.id}`, body) : apiPost<NetworkPort>(`/admin/network/nodes/${node?.id}/ports`, body),
    onSuccess: () => {
      toast.success(editing ? "Porta atualizada" : "Porta adicionada");
      setEditing(null);
      setForm({ ...blank });
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar a porta")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<OkResponse>(`/admin/network/ports/${id}`),
    onSuccess: () => { toast.success("Porta removida"); onSaved(); },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível remover a porta")),
  });

  const startEdit = (port: NetworkPort) => {
    setEditing(port);
    setForm({ name: port.name, comment: port.comment, vlan: port.vlan });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" data-testid="network-ports-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Portas · {node?.name}</DialogTitle>
          <DialogDescription>Use o comentário para registrar destino, rack, VLAN, patch cord ou qualquer identificação operacional.</DialogDescription>
        </DialogHeader>
        <form className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 md:grid-cols-[1fr_1.4fr_.8fr_auto] md:items-end" onSubmit={(event) => { event.preventDefault(); save.mutate(form); }}>
          <div className="space-y-1.5">
            <Label htmlFor="network-port-name">Porta / identificação</Label>
            <Input id="network-port-name" data-testid="network-port-name-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Gi1/0/1 ou PP-01" required className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="network-port-comment">Comentário</Label>
            <Input id="network-port-comment" data-testid="network-port-comment-input" value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="Uplink para SW-02" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="network-port-vlan">VLAN</Label>
            <Input id="network-port-vlan" value={form.vlan} onChange={(event) => setForm({ ...form, vlan: event.target.value })} placeholder="10 / trunk" />
          </div>
          <Button type="submit" disabled={save.isPending} className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500">
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            {editing ? "Atualizar" : "Adicionar"}
          </Button>
        </form>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          {ports.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Nenhuma porta cadastrada para este equipamento.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {ports.map((port) => (
                <div key={port.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-24 font-mono text-sm font-semibold text-sky-300">{port.name}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{port.comment || <span className="text-slate-600">Sem comentário</span>}</span>
                  {port.vlan && <span className="rounded border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-mono text-[11px] text-violet-300">VLAN {port.vlan}</span>}
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar porta ${port.name}`} onClick={() => startEdit(port)}><Pencil className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Excluir porta ${port.name}`} className="text-red-400 hover:text-red-300" onClick={() => { if (window.confirm(`Excluir a porta ${port.name}? Os enlaces associados perderão essa associação.`)) remove.mutate(port.id); }}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
