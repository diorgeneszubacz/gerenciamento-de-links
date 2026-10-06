import { useQuery } from "@tanstack/react-query";
import { Clock, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { SystemHealth } from "@/lib/types";
import Metric from "@/components/Metric";

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
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}

/** Four health tiles (CPU, memória, disco, tempo ligado) — rendered inside the parent grid. */
export default function SystemHealthBar() {
  const q = useQuery({
    queryKey: ["system"],
    queryFn: () => apiGet<SystemHealth>("/system"),
    refetchInterval: 10_000,
    retry: false,
  });
  const s = q.isError ? undefined : q.data;
  const host = s ? `${s.hostname} · ${s.os_name}` : undefined;

  return (
    <>
      <Metric
        label="CPU"
        value={s ? `${s.cpu_percent.toFixed(0)}%` : "–"}
        icon={Cpu}
        tone="text-sky-400"
        testId="system-cpu"
        percent={s?.cpu_percent}
        title={s ? `${s.cpu_count} núcleos · carga ${s.load_avg.map((x) => x.toFixed(2)).join(" / ")} · ${host}` : undefined}
      />
      <Metric
        label="Memória"
        value={s ? `${s.mem_percent.toFixed(0)}%` : "–"}
        icon={MemoryStick}
        tone="text-violet-300"
        testId="system-memory"
        percent={s?.mem_percent}
        title={s ? `${fmtBytes(s.mem_used)} de ${fmtBytes(s.mem_total)}` : undefined}
      />
      <Metric
        label="Disco"
        value={s ? `${s.disk_percent.toFixed(0)}%` : "–"}
        icon={HardDrive}
        tone="text-amber-400"
        testId="system-disk"
        percent={s?.disk_percent}
        title={s ? `${fmtBytes(s.disk_used)} de ${fmtBytes(s.disk_total)}` : undefined}
      />
      <Metric
        label="Tempo ligado"
        value={s ? fmtUptime(s.uptime_seconds) : "–"}
        icon={Clock}
        tone="text-emerald-400"
        testId="system-uptime"
        title={s ? `Ligado desde ${new Date(Date.now() - s.uptime_seconds * 1000).toLocaleString("pt-BR")} · ${host}` : undefined}
      />
    </>
  );
}
