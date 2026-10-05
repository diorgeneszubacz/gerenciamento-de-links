import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { LogoSuggestIn, LogoSuggestion, ServiceIn } from "@/lib/types";
import { errorMessage, readFileAsDataUrl, shrinkImage } from "@/lib/hub";
import { Button } from "@/components/ui/button";
import ServiceLogo from "@/components/ServiceLogo";
import { cn } from "@/lib/utils";

interface Props {
  form: ServiceIn;
  value: string | null;
  onChange: (logo: string | null) => void;
}

export default function LogoPicker({ form, value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<LogoSuggestion[] | null>(null);

  const suggest = useMutation({
    mutationFn: (body: LogoSuggestIn) => apiPost<LogoSuggestion[]>("/admin/logos/suggest", body),
    onSuccess: (list) => {
      setSuggestions(list);
      if (list.length === 0) toast.info("Nenhuma logo encontrada automaticamente. Envie uma imagem.");
    },
    onError: (e) => toast.error(errorMessage(e, "Falha ao buscar logos")),
  });

  const runSuggest = () => {
    if (!form.name.trim()) {
      toast.error("Preencha o nome do serviço para buscar a logo");
      return;
    }
    suggest.mutate({ name: form.name, url_mode: form.url_mode, protocol: form.protocol, port: form.port, url: form.url });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Imagem muito grande (máx. 2 MB)");
      return;
    }
    onChange(await shrinkImage(await readFileAsDataUrl(file)));
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <ServiceLogo logo={value} name={form.name || "?"} className="size-16" testId="logo-preview" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-100">Logo do serviço</div>
          <div className="text-xs text-slate-400">Envie uma imagem pequena (PNG, SVG, WEBP) ou busque automaticamente.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden data-testid="logo-file-input" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" data-testid="logo-upload-btn" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="size-4" /> Enviar
          </Button>
          <Button type="button" variant="outline" size="sm" data-testid="logo-suggest-btn" onClick={runSuggest} disabled={suggest.isPending} className="gap-1.5 border-sky-800 text-sky-300">
            {suggest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Buscar automático
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" data-testid="logo-remove-btn" onClick={() => onChange(null)} className="gap-1.5 text-red-400">
              <Trash2 className="size-4" /> Remover
            </Button>
          )}
        </div>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sugestões — clique para usar</div>
          <div className="flex flex-wrap gap-2" data-testid="logo-suggestions">
            {suggestions.map((s, i) => (
              <button
                type="button"
                key={i}
                title={s.label}
                data-testid="logo-suggestion-item"
                onClick={async () => onChange(await shrinkImage(s.data_url))}
                className={cn(
                  "flex size-16 items-center justify-center rounded-xl border bg-slate-900 p-2 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-sky-500",
                  "border-slate-700",
                )}
              >
                <img src={s.data_url} alt={s.label} className="size-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
