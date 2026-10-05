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
