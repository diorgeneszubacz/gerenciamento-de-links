import { cn } from "@/lib/utils";

/** 27º BPM/M battalion crest. */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo-27bpmm.png"
      alt="Brasão do 27º BPM/M"
      data-testid="brand-logo"
      className={cn("h-12 w-auto shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]", className)}
    />
  );
}
