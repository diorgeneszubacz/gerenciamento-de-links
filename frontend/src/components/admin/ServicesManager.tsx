import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Category, OkResponse, ReorderIn, Service } from "@/lib/types";
import { errorMessage, serviceHref, serviceTarget } from "@/lib/hub";
import { categoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ServiceLogo from "@/components/ServiceLogo";
import SortableList from "./SortableList";
import ServiceDialog from "./ServiceDialog";

export default function ServicesManager() {
  const qc = useQueryClient();
  const servicesQ = useQuery({ queryKey: ["admin-services"], queryFn: () => apiGet<Service[]>("/admin/services") });
  const catsQ = useQuery({ queryKey: ["admin-categories"], queryFn: () => apiGet<Category[]>("/admin/categories") });
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);

  const services = servicesQ.data ?? [];
  const categories = catsQ.data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-services"] });
    qc.invalidateQueries({ queryKey: ["portal"] });
    qc.invalidateQueries({ queryKey: ["status"] });
  };

  const reorder = useMutation({
    mutationFn: (body: ReorderIn) => apiPost<OkResponse>("/admin/services/reorder", body),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<OkResponse>(`/admin/services/${id}`),
    onSuccess: () => toast.success("Serviço removido"),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  });

  const groups = useMemo(() => {
    const known = new Set(categories.map((c) => c.id));
    const g = categories.map((c) => ({ cat: c as Category | null, items: services.filter((s) => s.category_id === c.id) }));
    const orphans = services.filter((s) => !known.has(s.category_id));
    if (orphans.length) g.push({ cat: null, items: orphans });
    return g;
  }, [services, categories]);

  const handleReorder = (groupIndex: number, next: Service[]) => {
    const ordered = groups.flatMap((g, i) => (i === groupIndex ? next : g.items));
    qc.setQueryData<Service[]>(["admin-services"], ordered.map((s, i) => ({ ...s, order: i })));
    reorder.mutate({ ids: ordered.map((s) => s.id) });
  };

  const openNew = () => {
    if (categories.length === 0) {
      toast.error("Crie uma categoria antes de adicionar serviços");
      return;
    }
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-white">Serviços</h2>
          <p className="text-sm text-slate-400">Arraste ou use as setas para mudar a posição dos links.</p>
        </div>
        <Button data-testid="admin-add-service-btn" onClick={openNew} className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500">
          <Plus className="size-4" /> Novo serviço
        </Button>
      </div>

      {servicesQ.isLoading && <div className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />}

      {!servicesQ.isLoading && services.length === 0 && (
        <div data-testid="services-empty" className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-400">
          Nenhum serviço cadastrado.
        </div>
      )}

      {groups.map((g, gi) => {
        if (g.items.length === 0) return null;
        const Icon = g.cat ? categoryIcon(g.cat.icon) : EyeOff;
        return (
          <section key={g.cat?.id ?? "orphans"} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/40 px-4 py-2.5">
              <Icon className="size-4 text-sky-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{g.cat?.name ?? "Sem categoria"}</span>
            </div>
            <SortableList
              items={g.items}
              getId={(s) => s.id}
              testIdPrefix="admin-service"
              onReorder={(next) => handleReorder(gi, next)}
              render={(s) => (
                <div className="flex items-center gap-3">
                  <ServiceLogo logo={s.logo} name={s.name} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span data-testid="admin-service-name" className="truncate font-medium text-white">{s.name}</span>
                      {!s.visible && <Badge variant="secondary" className="text-[10px]">Oculto</Badge>}
                    </div>
                    <a href={serviceHref(s)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-sky-400 hover:underline">
                      {s.url_mode === "url" ? s.url : serviceTarget(s)}
                    </a>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Editar serviço" data-testid="admin-edit-service-btn" onClick={() => { setEditing(s); setOpen(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Excluir serviço"
                    data-testid="admin-delete-service-btn"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => { if (window.confirm(`Excluir o serviço "${s.name}"?`)) remove.mutate(s.id); }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            />
          </section>
        );
      })}

      <ServiceDialog open={open} onOpenChange={setOpen} service={editing} categories={categories} onSaved={invalidate} />
    </div>
  );
}
