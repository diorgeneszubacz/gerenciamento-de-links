import { useQuery } from "@tanstack/react-query";
import { Clock, Cpu, HardDrive, MemoryStick } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { SystemHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmtBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}min`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function tone(p: number): string {
  if (p >= 85) return "bg-red-500";
  if (p >= 65) return "bg-amber-500";
  return "bg-sky-500";
}

interface GaugeProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  percent?: number;
  testId: string;
}

function Gauge({ icon: Icon, label, value, detail, percent, testId }: GaugeProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        <Icon className="size-3.5 text-sky-400" /> {label}
      </div>
      <div data-testid={testId} className="mt-2 font-heading text-2xl font-semibold leading-none text-white">{value}</div>
      <div className="mt-1 truncate text-xs text-slate-400">{detail}</div>
      {percent !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone(percent))}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function SystemHealthBar() {
  const q = useQuery({
    queryKey: ["system"],
    queryFn: () => apiGet<SystemHealth>("/system"),
    refetchInterval: 10_000,
    retry: false,
  });
  const s = q.isError ? undefined : q.data;

  return (
    <section data-testid="system-health" className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="shrink-0 whitespace-nowrap font-semibold uppercase tracking-[0.18em] text-slate-500">Saúde do servidor</span>
        {s && <span data-testid="system-os" className="truncate font-mono">· {s.hostname} · {s.os_name}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Gauge
          icon={Cpu}
          label="CPU"
          value={s ? `${s.cpu_percent.toFixed(0)}%` : "–"}
          detail={s ? `${s.cpu_count} núcleos · carga ${s.load_avg.map((x) => x.toFixed(2)).join(" / ")}` : "Carregando…"}
          percent={s?.cpu_percent}
          testId="system-cpu"
        />
        <Gauge
          icon={MemoryStick}
          label="Memória"
          value={s ? `${s.mem_percent.toFixed(0)}%` : "–"}
          detail={s ? `${fmtBytes(s.mem_used)} de ${fmtBytes(s.mem_total)}` : "Carregando…"}
          percent={s?.mem_percent}
          testId="system-memory"
        />
        <Gauge
          icon={HardDrive}
          label="Disco /"
          value={s ? `${s.disk_percent.toFixed(0)}%` : "–"}
          detail={s ? `${fmtBytes(s.disk_used)} de ${fmtBytes(s.disk_total)}` : "Carregando…"}
          percent={s?.disk_percent}
          testId="system-disk"
        />
        <Gauge
          icon={Clock}
          label="Tempo ligado"
          value={s ? fmtUptime(s.uptime_seconds) : "–"}
          detail={s ? `desde ${new Date(Date.now() - s.uptime_seconds * 1000).toLocaleString("pt-BR")}` : "Carregando…"}
          testId="system-uptime"
        />
      </div>
    </section>
  );
}
