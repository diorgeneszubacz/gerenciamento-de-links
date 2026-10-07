import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
  testId: string;
  percent?: number;
  title?: string;
  /** When provided, the tile becomes a clickable button that opens a popover with this content. */
  details?: ReactNode;
}

function barTone(p: number): string {
  if (p >= 85) return "bg-red-500";
  if (p >= 65) return "bg-amber-500";
  return "bg-sky-500";
}

/** Small stat tile used in the portal's top-right panel. Clickable (shows `details`) when provided. */
export default function Metric({ label, value, icon: Icon, tone, testId, percent, title, details }: Props) {
  const body = (
    <>
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
    </>
  );

  const tileClass = "relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3 text-left backdrop-blur transition-colors";

  if (!details) {
    return <div title={title} className={tileClass}>{body}</div>;
  }

  return (
    <Popover>
      <PopoverTrigger
        data-testid={`${testId}-trigger`}
        title={title}
        className={cn(tileClass, "cursor-pointer hover:border-slate-700 hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500")}
      >
        {body}
      </PopoverTrigger>
      <PopoverContent data-testid={`${testId}-details`} align="start" className="w-80 border-slate-800 bg-slate-900/95">
        {details}
      </PopoverContent>
    </Popover>
  );
}
