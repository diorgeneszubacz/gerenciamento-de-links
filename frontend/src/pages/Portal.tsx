import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowUpRight, LayoutGrid, Lock, RefreshCw, Search, Wifi, WifiOff, Layers } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PortalData, Service, StatusMap } from "@/lib/types";
import { serviceHref, serviceTarget } from "@/lib/hub";
import { categoryIcon } from "@/lib/category-icons";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandMark from "@/components/BrandMark";
import ServiceLogo from "@/components/ServiceLogo";
import StatusDot from "@/components/StatusDot";
import type { DotState } from "@/components/StatusDot";
import { cn } from "@/lib/utils";

function ServiceCard({ service, state, index }: { service: Service; state: DotState; index: number }) {
  return (
    <motion.a
      data-testid="service-card-item"
      href={serviceHref(service)}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay: Math.min(index * 0.03, 0.3) }}
      className="group relative flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#131C31]/90 p-5 transition-[transform,border-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-slate-600 hover:shadow-xl hover:shadow-sky-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="flex items-start justify-between gap-3">
        <ServiceLogo logo={service.logo} name={service.name} />
        <StatusDot state={state} showLabel testId={`service-status-${service.id}`} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 data-testid="service-card-name" className="truncate font-heading text-lg font-semibold tracking-tight text-white">
          {service.name}
        </h3>
        {service.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">{service.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate rounded-md border border-sky-800/40 bg-sky-950/70 px-2 py-0.5 font-mono text-xs font-medium text-sky-400">
          {service.protocol === "https" && service.url_mode === "port" ? "https " : ""}
          {serviceTarget(service)}
        </span>
        <span
          data-testid="service-open-link"
          className="flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors duration-200 group-hover:text-sky-400"
        >
          Abrir <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.a>
  );
}

function Metric({ label, value, icon: Icon, tone, testId }: { label: string; value: string | number; icon: typeof Wifi; tone: string; testId: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 backdrop-blur">
      <Icon className={cn("size-4", tone)} />
      <div>
        <div data-testid={testId} className="font-heading text-xl font-semibold leading-none text-white">{value}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function Portal() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const portalQ = useQuery({ queryKey: ["portal"], queryFn: () => apiGet<PortalData>("/portal"), retry: 1 });
  const statusQ = useQuery({
    queryKey: ["status"],
    queryFn: () => apiGet<StatusMap>("/status"),
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const data = portalQ.isError ? undefined : portalQ.data;
  const statuses = statusQ.isError ? undefined : statusQ.data?.statuses;
  const categories = data?.categories ?? [];
  const services = data?.services ?? [];

  const stateOf = (id: string): DotState =>
    statuses === undefined || statuses[id] === undefined ? "pending" : statuses[id] ? "online" : "offline";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const catName = Object.fromEntries(categories.map((c) => [c.id, c.name.toLowerCase()]));
    return services.filter((s) => {
      if (activeCat !== "all" && s.category_id !== activeCat) return false;
      if (!q) return true;
      return [s.name, s.description, String(s.port ?? ""), s.path, s.url ?? "", catName[s.category_id] ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [services, categories, query, activeCat]);

  const onlineCount = statuses ? services.filter((s) => statuses[s.id]).length : null;
  const sections = categories
    .map((c) => ({ cat: c, items: filtered.filter((s) => s.category_id === c.id) }))
    .filter((s) => s.items.length > 0);

  let cardIndex = 0;

  return (
    <div className="hub-backdrop min-h-svh">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 shadow-md shadow-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" data-testid="brand-home-link">
            <BrandMark />
            <div className="hidden sm:block">
              <div className="font-heading text-base font-semibold leading-tight text-white">Server Hub</div>
              <div data-testid="server-hostname" className="font-mono text-xs text-slate-400">{window.location.hostname}</div>
            </div>
          </Link>
          <div className="relative ml-auto w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              ref={searchRef}
              data-testid="search-services-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar serviço, porta ou categoria…"
              className="h-10 border-slate-800 bg-slate-900/80 pl-9 pr-16"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:block">
              Ctrl K
            </kbd>
          </div>
          <Link
            to="/admin"
            data-testid="admin-login-nav-btn"
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "h-10 gap-2 border-slate-700 bg-slate-900/60")}
          >
            <Lock className="size-4" /> <span className="hidden sm:inline">Administração</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Painel de serviços</p>
            <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Tudo do seu servidor,<br className="hidden sm:block" /> em um só lugar.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-400">
              Acesse rapidamente as ferramentas e páginas hospedadas nesta máquina.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
            <Metric label="Serviços" value={services.length} icon={LayoutGrid} tone="text-sky-400" testId="metric-total" />
            <Metric label="Online" value={onlineCount ?? "–"} icon={Wifi} tone="text-emerald-400" testId="metric-online" />
            <Metric label="Offline" value={onlineCount === null ? "–" : services.length - onlineCount} icon={WifiOff} tone="text-red-400" testId="metric-offline" />
            <Metric label="Categorias" value={categories.length} icon={Layers} tone="text-crimson" testId="metric-categories" />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <button
            data-testid="category-filter-all"
            onClick={() => setActiveCat("all")}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
              activeCat === "all" ? "border-sky-500/60 bg-sky-500/15 text-sky-300" : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200",
            )}
          >
            Todos
          </button>
          {categories.map((c) => {
            const Icon = categoryIcon(c.icon);
            return (
              <button
                key={c.id}
                data-testid="category-filter-item"
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
                  activeCat === c.id ? "border-sky-500/60 bg-sky-500/15 text-sky-300" : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200",
                )}
              >
                <Icon className="size-3.5" /> {c.name}
              </button>
            );
          })}
          <button
            data-testid="refresh-status-btn"
            onClick={() => qc.invalidateQueries({ queryKey: ["status"] })}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-3.5 py-1.5 text-sm text-slate-400 transition-colors duration-200 hover:text-slate-200"
            aria-label="Atualizar status"
          >
            <RefreshCw className={cn("size-3.5", statusQ.isFetching && "animate-spin")} /> Atualizar status
          </button>
        </div>

        {portalQ.isLoading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
            ))}
          </div>
        )}

        {!portalQ.isLoading && sections.length === 0 && (
          <div data-testid="empty-state" className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
            {portalQ.isError
              ? "Não foi possível carregar os serviços agora."
              : query
                ? `Nenhum serviço encontrado para “${query}”.`
                : "Nenhum serviço cadastrado ainda. Entre na administração para adicionar."}
          </div>
        )}

        {sections.map(({ cat, items }) => {
          const Icon = categoryIcon(cat.icon);
          return (
            <section key={cat.id} data-testid="category-section" className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-sky-400">
                  <Icon className="size-4" />
                </span>
                <h2 className="font-heading text-xl font-semibold tracking-tight text-white">{cat.name}</h2>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{items.length}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((s) => (
                  <ServiceCard key={s.id} service={s} state={stateOf(s.id)} index={cardIndex++} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-slate-500 sm:px-6 lg:px-8">
        Status verificado automaticamente a cada 30 segundos
        {statusQ.data && !statusQ.isError && ` · última verificação ${new Date(statusQ.data.checked_at).toLocaleTimeString("pt-BR")}`}
      </footer>
    </div>
  );
}
