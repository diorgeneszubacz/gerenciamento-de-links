import type { NetworkNodeStatus, NetworkNodeType } from "@/lib/types";

export const NETWORK_NODE_TYPE_LABELS: Record<NetworkNodeType, string> = {
  router: "Roteador",
  switch: "Switch",
  firewall: "Firewall",
  server: "Servidor",
  access_point: "Access point",
  patch_panel: "Patch panel",
  ups: "UPS",
  other: "Outro",
};

export function networkStatusStyle(status: NetworkNodeStatus["status"]) {
  if (status === "online") return { dot: "bg-emerald-400", text: "Online", color: "text-emerald-300" };
  if (status === "offline") return { dot: "bg-red-400", text: "Offline", color: "text-red-300" };
  if (status === "disabled") return { dot: "bg-slate-500", text: "Manual", color: "text-slate-400" };
  return { dot: "bg-amber-400", text: "Sem dados", color: "text-amber-300" };
}
