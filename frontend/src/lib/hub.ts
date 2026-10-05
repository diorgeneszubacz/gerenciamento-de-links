import { ApiError } from "./api";
import type { ServiceIn } from "./types";

/** Builds the link a browser should open. Port-mode services use the host the visitor typed. */
export function serviceHref(s: Pick<ServiceIn, "url_mode" | "protocol" | "port" | "path" | "url">): string {
  if (s.url_mode === "url") return s.url ?? "#";
  const host = window.location.hostname;
  const defaultPort = s.protocol === "https" ? 443 : 80;
  const port = s.port && s.port !== defaultPort ? `:${s.port}` : "";
  return `${s.protocol}://${host}${port}${s.path || "/"}`;
}

/** Short label shown in the port chip. */
export function serviceTarget(s: Pick<ServiceIn, "url_mode" | "port" | "path" | "url">): string {
  if (s.url_mode === "url") {
    try {
      const u = new URL(s.url ?? "");
      return u.host;
    } catch {
      return s.url ?? "";
    }
  }
  return `:${s.port ?? ""}${s.path && s.path !== "/" ? s.path : ""}`;
}

export function errorMessage(err: unknown, fallback = "Ocorreu um erro"): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg.replace(/^Value error, /, "");
    }
  }
  return fallback;
}

/** Downscale any image data URL to a small PNG so logos stay light. */
export function shrinkImage(dataUrl: string, max = 128): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || max;
      const h = img.naturalHeight || max;
      const scale = Math.min(1, max / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
