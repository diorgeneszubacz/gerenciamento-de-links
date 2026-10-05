import {
  Box, Briefcase, Cloud, Database, Download, Folder, Globe, HardDrive, Monitor, Network, Printer,
  Server, Shield, Wrench, Film, Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  server: { icon: Server, label: "Servidor" },
  database: { icon: Database, label: "Banco de dados" },
  printer: { icon: Printer, label: "Impressão" },
  download: { icon: Download, label: "Downloads" },
  folder: { icon: Folder, label: "Pasta" },
  shield: { icon: Shield, label: "Segurança" },
  network: { icon: Network, label: "Rede" },
  monitor: { icon: Monitor, label: "Monitoramento" },
  cloud: { icon: Cloud, label: "Nuvem" },
  wrench: { icon: Wrench, label: "Ferramentas" },
  briefcase: { icon: Briefcase, label: "Interno" },
  globe: { icon: Globe, label: "Web" },
  harddrive: { icon: HardDrive, label: "Armazenamento" },
  box: { icon: Box, label: "Containers" },
  film: { icon: Film, label: "Mídia" },
  mail: { icon: Mail, label: "E-mail" },
};

export function categoryIcon(key: string): LucideIcon {
  return CATEGORY_ICONS[key]?.icon ?? Folder;
}
