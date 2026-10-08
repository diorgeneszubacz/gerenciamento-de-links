import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { LoginIn, User } from "@/lib/types";
import { beginSession } from "@/lib/session";
import { errorMessage } from "@/lib/hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandMark from "@/components/BrandMark";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: (body: LoginIn) => apiPost<User>("/auth/login", body),
    onSuccess: (u) => {
      beginSession();
      toast.success(`Bem-vindo, ${u.username}`);
      const next = new URLSearchParams(location.search).get("next");
      navigate(next?.startsWith("/") && !next.startsWith("//") ? next : "/admin");
    },
    onError: (e) => toast.error(errorMessage(e, "Falha no login")),
  });

  return (
    <div className="hub-backdrop flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/" data-testid="login-back-link" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200">
          <ArrowLeft className="size-4" /> Voltar ao portal
        </Link>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-white">Administração</h1>
              <p className="text-sm text-slate-400">Entre para gerenciar os serviços</p>
            </div>
          </div>
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate({ username, password });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input id="username" data-testid="login-username-input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" data-testid="login-password-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" required />
            </div>
            <Button type="submit" data-testid="login-submit-btn" disabled={login.isPending} className="h-11 w-full bg-sky-600 text-white hover:bg-sky-500">
              {login.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
