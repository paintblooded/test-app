import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const SESSION_KEY = "sonara_session_token";

export async function setToken(token: string | null) {
  if (token) await storage.secureSet(SESSION_KEY, token);
  else await storage.secureRemove(SESSION_KEY);
}

export async function getToken(): Promise<string | null> {
  const t = await storage.secureGet<string>(SESSION_KEY, "");
  return t || null;
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `HTTP ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg)) as any;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export function wsUrl(token: string): string {
  // BASE is https://...preview... → wss://...preview.../api/ws
  const baseWs = BASE!.replace(/^http/, "ws");
  return `${baseWs}/api/ws?token=${encodeURIComponent(token)}`;
}
