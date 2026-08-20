const STORAGE_KEY = "terminal-chat-server-url";
export const DEFAULT_SERVER = "https://terminal-chat-6pet.onrender.com";

export function getServerHttpUrl(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  const configured = saved || import.meta.env.VITE_API_URL || DEFAULT_SERVER;
  try {
    return normalizeServerHttpUrl(configured);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return normalizeServerHttpUrl(
      import.meta.env.VITE_API_URL || DEFAULT_SERVER,
    );
  }
}

export function setServerHttpUrl(value: string): string {
  const normalized = normalizeServerHttpUrl(value);
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function getServerWebSocketUrl(): string {
  const url = new URL(getServerHttpUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  return url.toString();
}

export function normalizeServerHttpUrl(value: string): string {
  let candidate = value.trim();
  if (!candidate) throw new Error("Informe o endereço do servidor");
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(candidate)
      ? `http://${candidate}`
      : `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("O endereço do servidor não é válido");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("O servidor precisa usar HTTP ou HTTPS");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}
