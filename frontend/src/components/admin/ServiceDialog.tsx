import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Globe, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import type { Category, Protocol, Service, ServiceIn } from "@/lib/types";
import { errorMessage, serviceHref } from "@/lib/hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LogoPicker from "./LogoPicker";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  categories: Category[];
  onSaved: () => void;
}

const blank = (categoryId: string): ServiceIn => ({
  name: "", description: "", category_id: categoryId, url_mode: "port", protocol: "http",
  port: 80, path: "/", url: "", logo: null, visible: true,
});

export default function ServiceDialog({ open, onOpenChange, service, categories, onSaved }: Props) {
  const [form, setForm] = useState<ServiceIn>(blank(categories[0]?.id ?? ""));

  useEffect(() => {
    if (!open) return;
    if (service) {
      const { id: _id, order: _order, ...rest } = service;
      setForm({ ...rest, url: rest.url ?? "" });
    } else {
      setForm(blank(categories[0]?.id ?? ""));
    }
  }, [open, service, categories]);

  const set = <K extends keyof ServiceIn>(key: K, value: ServiceIn[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: (body: ServiceIn) =>
      service ? apiPut<Service>(`/admin/services/${service.id}`, body) : apiPost<Service>("/admin/services", body),
    onSuccess: () => {
      toast.success(service ? "Serviço atualizado" : "Serviço adicionado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível salvar")),
  });

  const submit = () => {
    const body: ServiceIn = {
      ...form,
      name: form.name.trim(),
      port: form.url_mode === "port" ? form.port : null,
      url: form.url_mode === "url" ? (form.url ?? "").trim() : null,
    };
    save.mutate(body);
  };

  const catLabel = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" data-testid="service-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>Configure o link, a logo e onde ele aparece no portal.</DialogDescription>
        </DialogHeader>

        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="svc-name">Nome</Label>
            <Input id="svc-name" data-testid="service-name-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Webmin" required />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v: string) => set("category_id", v)}>
              <SelectTrigger className="w-full" data-testid="service-category-select">
                <SelectValue>{(v) => catLabel[v as string] ?? "Selecione"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} data-testid={`service-category-option-${c.id}`}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="svc-desc">Descrição</Label>
            <Textarea id="svc-desc" data-testid="service-description-input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Para que serve este serviço?" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Tipo de link</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["port", Plug, "Porta nesta máquina", "Usa o mesmo endereço do portal + porta"],
                ["url", Globe, "URL completa", "Endereço fixo digitado por você"],
              ] as const).map(([mode, Icon, title, hint]) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`service-mode-${mode}`}
                  onClick={() => set("url_mode", mode)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-150",
                    form.url_mode === mode ? "border-sky-500/70 bg-sky-500/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-700",
                  )}
                >
                  <Icon className={cn("mt-0.5 size-4", form.url_mode === mode ? "text-sky-400" : "text-slate-500")} />
                  <span>
                    <span className="block text-sm font-medium text-slate-100">{title}</span>
                    <span className="block text-xs text-slate-400">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {form.url_mode === "port" ? (
            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <div className="space-y-2">
                <Label>Protocolo</Label>
                <Select value={form.protocol} onValueChange={(v: string) => set("protocol", v as Protocol)}>
                  <SelectTrigger className="w-full" data-testid="service-protocol-select">
                    <SelectValue>{(v) => String(v).toUpperCase()}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-port">Porta</Label>
                <Input
                  id="svc-port"
                  data-testid="service-port-input"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port ?? ""}
                  onChange={(e) => set("port", e.target.value === "" ? null : Number(e.target.value))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-path">Caminho</Label>
                <Input id="svc-path" data-testid="service-path-input" value={form.path} onChange={(e) => set("path", e.target.value)} placeholder="/" className="font-mono" />
              </div>
            </div>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="svc-url">URL</Label>
              <Input id="svc-url" data-testid="service-url-input" value={form.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="http://192.168.0.10:10000/" className="font-mono" />
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Link gerado</span>
            <div data-testid="service-url-preview" className="truncate font-mono text-sm text-sky-400">{serviceHref(form)}</div>
          </div>

          <div className="md:col-span-2">
            <LogoPicker form={form} value={form.logo} onChange={(logo) => set("logo", logo)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
            <Checkbox data-testid="service-visible-checkbox" checked={form.visible} onCheckedChange={(c) => set("visible", Boolean(c))} />
            Exibir no portal público
          </label>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="service-modal-cancel-btn">Cancelar</Button>
            <Button type="submit" data-testid="service-modal-save-btn" disabled={save.isPending} className="bg-sky-600 text-white hover:bg-sky-500">
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
