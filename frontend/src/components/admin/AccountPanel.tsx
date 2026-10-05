import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { OkResponse, PasswordChange, User } from "@/lib/types";
import { errorMessage } from "@/lib/hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountPanel({ me }: { me: User }) {
  const [form, setForm] = useState<PasswordChange>({ current_password: "", new_password: "" });
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: (body: PasswordChange) => apiPost<OkResponse>("/auth/change-password", body),
    onSuccess: () => {
      toast.success("Sua senha foi alterada");
      setForm({ current_password: "", new_password: "" });
      setConfirm("");
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível alterar a senha")),
  });

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-white">Minha conta</h2>
        <p className="text-sm text-slate-400">Conectado como <span className="text-slate-200">{me.username}</span>.</p>
      </div>
      <form
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.new_password !== confirm) {
            toast.error("A confirmação não confere");
            return;
          }
          change.mutate(form);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="cur-pw">Senha atual</Label>
          <Input id="cur-pw" type="password" data-testid="account-current-password-input" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-pw">Nova senha</Label>
          <Input id="new-pw" type="password" data-testid="account-new-password-input" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} minLength={6} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conf-pw">Confirmar nova senha</Label>
          <Input id="conf-pw" type="password" data-testid="account-confirm-password-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
        </div>
        <Button type="submit" data-testid="account-change-password-btn" disabled={change.isPending} className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500">
          {change.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Alterar senha
        </Button>
      </form>
    </div>
  );
}
