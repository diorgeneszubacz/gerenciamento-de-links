import type { NetworkNodeStatus, NetworkNodeType } from "@/lib/types";
import { Box, Camera, Cloud, Database, HardDrive, Laptop, Network, Printer, Router, Server, Shield, Smartphone, Wifi } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const NETWORK_NODE_TYPE_LABELS: Record<NetworkNodeType, string> = {
  cloud: "Nuvem / Internet",
  router: "Roteador",
  switch: "Switch",
  firewall: "Firewall",
  server: "Servidor",
  computer: "Computador",
  access_point: "Wi-Fi / Access point",
  patch_panel: "Patch panel",
  printer: "Impressora",
  camera: "Câmera IP",
  phone: "Telefone IP",
  database: "Banco de dados",
  nas: "NAS / Storage",
  ups: "UPS",
  other: "Outro",
};

export const NETWORK_NODE_ICONS: Record<NetworkNodeType, LucideIcon> = {
  cloud: Cloud,
  router: Router,
  switch: Network,
  firewall: Shield,
  server: Server,
  computer: Laptop,
  access_point: Wifi,
  patch_panel: HardDrive,
  printer: Printer,
  camera: Camera,
  phone: Smartphone,
  database: Database,
  nas: HardDrive,
  ups: Box,
  other: Box,
};

export function networkStatusStyle(status: NetworkNodeStatus["status"]) {
  if (status === "online") return { dot: "bg-emerald-400", text: "Online", color: "text-emerald-300" };
  if (status === "offline") return { dot: "bg-red-400", text: "Offline", color: "text-red-300" };
  if (status === "disabled") return { dot: "bg-slate-500", text: "Manual", color: "text-slate-400" };
  return { dot: "bg-amber-400", text: "Sem dados", color: "text-amber-300" };
}
