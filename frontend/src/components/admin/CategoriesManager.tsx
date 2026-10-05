import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { Category, CategoryIn, OkResponse, ReorderIn, Service } from "@/lib/types";
import { errorMessage } from "@/lib/hub";
import { CATEGORY_ICONS, categoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SortableList from "./SortableList";
import { cn } from "@/lib/utils";

export default function CategoriesManager() {
  const qc = useQueryClient();
  const catsQ = useQuery({ queryKey: ["admin-categories"], queryFn: () => apiGet<Category[]>("/admin/categories") });
  const servicesQ = useQuery({ queryKey: ["admin-services"], queryFn: () => apiGet<Service[]>("/admin/services") });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryIn>({ name: "", icon: "folder" });

  const categories = catsQ.data ?? [];
  const countFor = (id: string) => (servicesQ.data ?? []).filter((s) => s.category_id === id).length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
    qc.invalidateQueries({ queryKey: ["portal"] });
  };

  const save = useMutation({
    mutationFn: (body: CategoryIn) =>
      editing ? apiPut<Category>(`/admin/categories/${editing.id}`, body) : apiPost<Category>("/admin/categories", body),
    onSuccess: () => {
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      setOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível salvar")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<OkResponse>(`/admin/categories/${id}`),
    onSuccess: () => toast.success("Categoria removida"),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (body: ReorderIn) => apiPost<OkResponse>("/admin/categories/reorder", body),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  });

  const openEdit = (c: Category | null) => {
    setEditing(c);
    setForm(c ? { name: c.name, icon: c.icon } : { name: "", icon: "folder" });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-white">Categorias</h2>
          <p className="text-sm text-slate-400">A ordem aqui define a ordem das seções no portal.</p>
        </div>
        <Button data-testid="admin-add-category-btn" onClick={() => openEdit(null)} className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500">
          <Plus className="size-4" /> Nova categoria
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl">
        {categories.length === 0 && !catsQ.isLoading ? (
          <div className="p-10 text-center text-slate-400" data-testid="categories-empty">Nenhuma categoria.</div>
        ) : (
          <SortableList
            items={categories}
            getId={(c) => c.id}
            testIdPrefix="admin-category"
            onReorder={(next) => {
              qc.setQueryData<Category[]>(["admin-categories"], next.map((c, i) => ({ ...c, order: i })));
              reorder.mutate({ ids: next.map((c) => c.id) });
            }}
            render={(c) => {
              const Icon = categoryIcon(c.icon);
              return (
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sky-400">
                    <Icon className="size-4" />
                  </span>
                  <span data-testid="admin-category-name" className="flex-1 truncate font-medium text-white">{c.name}</span>
                  <span className="text-xs text-slate-500">{countFor(c.id)} serviço(s)</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Editar categoria" data-testid="admin-edit-category-btn" onClick={() => openEdit(c)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Excluir categoria"
                    data-testid="admin-delete-category-btn"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => { if (window.confirm(`Excluir a categoria "${c.name}"?`)) remove.mutate(c.id); }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            }}
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-md" data-testid="category-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Defina o nome e o ícone da seção.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ name: form.name.trim(), icon: form.icon });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input id="cat-name" data-testid="category-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label }]) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    aria-label={label}
                    data-testid={`category-icon-${key}`}
                    onClick={() => setForm({ ...form, icon: key })}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg border transition-colors duration-150",
                      form.icon === key ? "border-sky-500 bg-sky-500/15 text-sky-300" : "border-slate-800 text-slate-400 hover:border-slate-600",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" data-testid="category-save-btn" disabled={save.isPending} className="bg-sky-600 text-white hover:bg-sky-500">
                {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
