import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { OkResponse, PasswordSet, User, UserCreate } from "@/lib/types";
import { errorMessage } from "@/lib/hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function UsersManager({ me }: { me: User }) {
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["users"], queryFn: () => apiGet<User[]>("/users") });
  const [newUser, setNewUser] = useState<UserCreate>({ username: "", password: "" });
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [newPw, setNewPw] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const create = useMutation({
    mutationFn: (body: UserCreate) => apiPost<User>("/users", body),
    onSuccess: (u) => {
      toast.success(`Usuário ${u.username} criado`);
      setNewUser({ username: "", password: "" });
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível criar o usuário")),
  });

  const setPassword = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PasswordSet }) => apiPut<OkResponse>(`/users/${id}/password`, body),
    onSuccess: () => {
      toast.success("Senha alterada");
      setPwTarget(null);
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível alterar a senha")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<OkResponse>(`/users/${id}`),
    onSuccess: () => toast.success("Usuário removido"),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-white">Usuários</h2>
        <p className="text-sm text-slate-400">Operadores podem gerenciar links e a própria senha, mas não criam usuários nem alteram a senha do administrador.</p>
      </div>

      <form
        className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ username: newUser.username.trim(), password: newUser.password });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="new-username">Novo usuário</Label>
          <Input id="new-username" data-testid="new-user-username-input" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="ex.: joao" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Senha (mín. 6)</Label>
          <Input id="new-password" type="password" data-testid="new-user-password-input" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required minLength={6} />
        </div>
        <Button type="submit" data-testid="admin-create-user-btn" disabled={create.isPending} className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500">
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Criar
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="hidden sm:table-cell">Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(usersQ.data ?? []).map((u) => (
              <TableRow key={u.id} data-testid="user-row">
                <TableCell data-testid="user-row-username" className="font-medium text-white">
                  {u.username} {u.id === me.id && <span className="text-xs text-slate-500">(você)</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={u.role === "admin" ? "border-crimson/50 text-pink-300" : "border-sky-700 text-sky-300"}>
                    {u.role === "admin" ? "Administrador" : "Operador"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-slate-400 sm:table-cell">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" data-testid="admin-reset-password-btn" onClick={() => { setPwTarget(u); setNewPw(""); }} className="gap-1.5">
                    <KeyRound className="size-4" /> Senha
                  </Button>
                  {u.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir usuário"
                      data-testid="admin-delete-user-btn"
                      className="text-red-400"
                      onClick={() => { if (window.confirm(`Excluir o usuário "${u.username}"?`)) remove.mutate(u.id); }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={pwTarget !== null} onOpenChange={(o) => { if (!o) setPwTarget(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="reset-password-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Alterar senha</DialogTitle>
            <DialogDescription>Nova senha para <strong>{pwTarget?.username}</strong>.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pwTarget) setPassword.mutate({ id: pwTarget.id, body: { password: newPw } });
            }}
          >
            <Input type="password" data-testid="reset-password-input" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={6} required placeholder="Nova senha" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwTarget(null)}>Cancelar</Button>
              <Button type="submit" data-testid="reset-password-save-btn" disabled={setPassword.isPending} className="bg-sky-600 text-white hover:bg-sky-500">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
