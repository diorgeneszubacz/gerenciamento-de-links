import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
  testId: string;
  percent?: number;
  title?: string;
}

function barTone(p: number): string {
  if (p >= 85) return "bg-red-500";
  if (p >= 65) return "bg-amber-500";
  return "bg-sky-500";
}

/** Small stat tile used in the portal's top-right panel. */
export default function Metric({ label, value, icon: Icon, tone, testId, percent, title }: Props) {
  return (
    <div
      title={title}
      className="relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3 backdrop-blur"
    >
      <Icon className={cn("size-4 shrink-0", tone)} />
      <div className="min-w-0">
        <div data-testid={testId} className="truncate font-heading text-xl font-semibold leading-none text-white">{value}</div>
        <div className="mt-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      </div>
      {percent !== undefined && (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-slate-800/80">
          <div
            className={cn("h-full transition-[width] duration-700 ease-out", barTone(percent))}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
    </div>
  );
}
