import { cn } from "@/lib/utils";

/** Debian-crimson brand badge with a minimal swirl mark. */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-xl bg-crimson shadow-lg shadow-crimson/25 ring-1 ring-white/10",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M15.5 8.2a5 5 0 1 0 .9 6.3" />
        <path d="M13.2 10.4a2 2 0 1 0 .3 2.9" />
      </svg>
    </span>
  );
}
