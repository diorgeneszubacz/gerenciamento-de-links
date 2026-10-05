import { useState } from "react";
import { Server } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  logo: string | null;
  name: string;
  className?: string;
  testId?: string;
}

export default function ServiceLogo({ logo, name, className, testId }: Props) {
  const [broken, setBroken] = useState(false);
  const showImg = logo && !broken;
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/90 p-2 shadow-inner",
        className,
      )}
    >
      {showImg ? (
        <img src={logo} alt={`Logo ${name}`} className="size-full object-contain" onError={() => setBroken(true)} />
      ) : (
        <span className="flex size-full items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/20 to-crimson/20 font-heading text-sm font-semibold text-slate-200">
          {name.trim().charAt(0).toUpperCase() || <Server className="size-5" />}
        </span>
      )}
    </div>
  );
}
