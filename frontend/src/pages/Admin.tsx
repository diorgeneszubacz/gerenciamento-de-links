import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Layers, LayoutGrid, Loader2, LogOut, UserCog, Users } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { endSession } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrandMark from "@/components/BrandMark";
import ServicesManager from "@/components/admin/ServicesManager";
import CategoriesManager from "@/components/admin/CategoriesManager";
import UsersManager from "@/components/admin/UsersManager";
import AccountPanel from "@/components/admin/AccountPanel";
import { cn } from "@/lib/utils";

export default function Admin() {
  const navigate = useNavigate();
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => apiGet<User>("/auth/me"), retry: false });

  useEffect(() => {
    if (meQ.error instanceof ApiError && meQ.error.status === 401) navigate("/login", { replace: true });
  }, [meQ.error, navigate]);

  const me = meQ.isError ? undefined : meQ.data;

  return (
    <div className="hub-backdrop min-h-svh">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <BrandMark className="size-9" />
          <div>
            <div className="font-heading text-base font-semibold leading-tight text-white">Server Hub</div>
            <div className="text-xs text-slate-400">Painel administrativo</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/" data-testid="admin-view-portal-link" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-slate-300")}>
              <ExternalLink className="size-4" /> <span className="hidden sm:inline">Ver portal</span>
            </Link>
            {me && (
              <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 sm:flex">
                <span data-testid="admin-current-user" className="text-sm text-slate-200">{me.username}</span>
                <Badge data-testid="admin-current-role" variant="outline" className={me.role === "admin" ? "border-crimson/50 text-pink-300" : "border-sky-700 text-sky-300"}>
                  {me.role === "admin" ? "Administrador" : "Operador"}
                </Badge>
              </div>
            )}
            <Button variant="outline" size="sm" data-testid="admin-logout-btn" onClick={() => endSession("/login")} className="gap-1.5">
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!me ? (
          <div className="flex items-center gap-2 text-slate-400" data-testid="admin-loading">
            {meQ.isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            {meQ.isLoading ? "Carregando…" : "Não foi possível verificar a sessão."}
          </div>
        ) : (
          <Tabs defaultValue="services" className="gap-6">
            <TabsList className="h-auto flex-wrap bg-slate-900/80 p-1">
              <TabsTrigger value="services" data-testid="tab-services" className="gap-1.5 px-3 py-1.5"><LayoutGrid className="size-4" /> Serviços</TabsTrigger>
              <TabsTrigger value="categories" data-testid="tab-categories" className="gap-1.5 px-3 py-1.5"><Layers className="size-4" /> Categorias</TabsTrigger>
              {me.role === "admin" && (
                <TabsTrigger value="users" data-testid="tab-users" className="gap-1.5 px-3 py-1.5"><Users className="size-4" /> Usuários</TabsTrigger>
              )}
              <TabsTrigger value="account" data-testid="tab-account" className="gap-1.5 px-3 py-1.5"><UserCog className="size-4" /> Minha conta</TabsTrigger>
            </TabsList>
            <TabsContent value="services"><ServicesManager /></TabsContent>
            <TabsContent value="categories"><CategoriesManager /></TabsContent>
            {me.role === "admin" && <TabsContent value="users"><UsersManager me={me} /></TabsContent>}
            <TabsContent value="account"><AccountPanel me={me} /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
