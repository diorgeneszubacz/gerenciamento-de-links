import { useQuery } from "@tanstack/react-query";
import { Clock, Cpu, HardDrive, MemoryStick, Database } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { DiskPartition, SystemHealth } from "@/lib/types";
import Metric from "@/components/Metric";
import { PopoverTitle } from "@/components/ui/popover";

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

/** Drill-down content for a disk card: per-partition usage. */
function PartitionsDetails({ title, partitions }: { title: string; partitions: DiskPartition[] }) {
  return (
    <>
      <PopoverTitle className="text-white">{title}</PopoverTitle>
      <div className="flex flex-col gap-2">
        {partitions.length === 0 && <span className="text-xs text-slate-500">Sem partições detectadas.</span>}
        {partitions.map((p) => (
          <div key={p.mount} data-testid="partition-row" className="rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-mono text-slate-300">{p.mount}</span>
              <span className="shrink-0 text-slate-500">{p.device.replace("/dev/", "")}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>{fmtBytes(p.used)} de {fmtBytes(p.total)}</span>
              <span>{p.percent.toFixed(0)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-500"
                style={{ width: `${Math.min(100, Math.max(0, p.percent))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Five health tiles (CPU, memória, NVME, disco/RAID, tempo ligado) — rendered inside the parent grid. */
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
        label="NVME"
        value={s ? `${s.nvme_percent.toFixed(0)}%` : "–"}
        icon={Database}
        tone="text-fuchsia-300"
        testId="system-nvme"
        percent={s?.nvme_percent}
        title={s ? `${fmtBytes(s.nvme_used)} de ${fmtBytes(s.nvme_total)} · clique para detalhes` : undefined}
        details={s && <PartitionsDetails title={`Disco de sistema (NVME) · ${fmtBytes(s.nvme_used)} de ${fmtBytes(s.nvme_total)}`} partitions={s.nvme_partitions} />}
      />
      <Metric
        label="Disco"
        value={s ? `${s.disk_percent.toFixed(0)}%` : "–"}
        icon={HardDrive}
        tone="text-amber-400"
        testId="system-disk"
        percent={s?.disk_percent}
        title={s ? `${fmtBytes(s.disk_used)} de ${fmtBytes(s.disk_total)} · clique para detalhes` : undefined}
        details={s && <PartitionsDetails title={`Armazenamento (RAID) · ${fmtBytes(s.disk_used)} de ${fmtBytes(s.disk_total)}`} partitions={s.disk_partitions} />}
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
