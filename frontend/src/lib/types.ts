// Hand-written mirrors of backend/models/schemas.py — keep in sync.

export interface CategoryIn {
  name: string;
  icon: string;
}

export interface Category extends CategoryIn {
  id: string;
  order: number;
}

export type UrlMode = "port" | "url";
export type Protocol = "http" | "https";

export interface ServiceIn {
  name: string;
  description: string;
  category_id: string;
  url_mode: UrlMode;
  protocol: Protocol;
  port: number | null;
  path: string;
  url: string | null;
  logo: string | null;
  visible: boolean;
}

export interface Service extends ServiceIn {
  id: string;
  order: number;
}

export interface ReorderIn {
  ids: string[];
}

export interface PortalData {
  categories: Category[];
  services: Service[];
}

export interface StatusMap {
  statuses: Record<string, boolean>;
  checked_at: string;
}

export type NetworkNodeType = "router" | "switch" | "firewall" | "server" | "access_point" | "patch_panel" | "ups" | "other";
export type MonitorProtocol = "icmp" | "tcp" | "http" | "none";
export type NetworkLinkType = "ethernet" | "fiber" | "wireless" | "logical" | "other";

export interface NetworkNodeIn {
  name: string;
  node_type: NetworkNodeType;
  description: string;
  host: string | null;
  monitor_protocol: MonitorProtocol;
  monitor_port: number | null;
  monitor_path: string;
  position_x: number;
  position_y: number;
  enabled: boolean;
  notes: string;
}

export interface NetworkNode extends NetworkNodeIn {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface NetworkPortIn {
  name: string;
  comment: string;
  vlan: string;
}

export interface NetworkPort extends NetworkPortIn {
  id: string;
  node_id: string;
  order: number;
  created_at: string;
}

export interface NetworkLinkIn {
  source_node_id: string;
  target_node_id: string;
  source_port_id: string | null;
  target_port_id: string | null;
  label: string;
  link_type: NetworkLinkType;
  comment: string;
  enabled: boolean;
}

export interface NetworkLink extends NetworkLinkIn {
  id: string;
  created_at: string;
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  ports: NetworkPort[];
  links: NetworkLink[];
}

export interface NetworkNodeStatus {
  node_id: string;
  status: "online" | "offline" | "unknown" | "disabled";
  latency_ms: number | null;
  error: string | null;
  checked_at: string | null;
  protocol: MonitorProtocol;
}

export interface NetworkStatus {
  nodes: NetworkNodeStatus[];
  checked_at: string;
}

export interface DiskPartition {
  mount: string;
  device: string;
  total: number;
  used: number;
  percent: number;
}

export interface SystemHealth {
  hostname: string;
  os_name: string;
  cpu_percent: number;
  cpu_count: number;
  load_avg: number[];
  mem_total: number;
  mem_used: number;
  mem_percent: number;
  disk_total: number;
  disk_used: number;
  disk_percent: number;
  disk_partitions: DiskPartition[];
  nvme_total: number;
  nvme_used: number;
  nvme_percent: number;
  nvme_partitions: DiskPartition[];
  uptime_seconds: number;
  checked_at: string;
}

export interface LogoSuggestIn {
  name: string;
  url_mode: UrlMode;
  protocol: Protocol;
  port: number | null;
  url: string | null;
}

export interface LogoSuggestion {
  source: string;
  label: string;
  data_url: string;
}

export type Role = "admin" | "operator";

export interface User {
  id: string;
  username: string;
  role: Role;
  created_at: string;
}

export interface LoginIn {
  username: string;
  password: string;
}

export interface UserCreate {
  username: string;
  password: string;
}

export interface PasswordSet {
  password: string;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

export interface OkResponse {
  ok: boolean;
}
