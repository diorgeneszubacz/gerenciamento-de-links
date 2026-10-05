import { cn } from "@/lib/utils";

export type DotState = "online" | "offline" | "pending";

const COLORS: Record<DotState, string> = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  pending: "bg-amber-500",
};

const LABELS: Record<DotState, string> = {
  online: "Online",
  offline: "Offline",
  pending: "Verificando",
};

export default function StatusDot({ state, showLabel = false, testId }: { state: DotState; showLabel?: boolean; testId?: string }) {
  return (
    <span data-testid={testId} data-state={state} className="inline-flex items-center gap-1.5" title={LABELS[state]}>
      <span className="relative flex size-2.5">
        {state === "online" && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={cn("relative inline-flex size-2.5 rounded-full", COLORS[state], state === "pending" && "animate-pulse")} />
      </span>
      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium",
            state === "online" && "text-emerald-400",
            state === "offline" && "text-red-400",
            state === "pending" && "text-amber-400",
          )}
        >
          {LABELS[state]}
        </span>
      )}
    </span>
  );
}
