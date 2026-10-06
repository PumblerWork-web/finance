import type { AuthStatus, DashboardData } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "The request could not be completed.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  authStatus: () => request<AuthStatus>("/api/auth/status"),
  setup: (displayName: string, password: string) =>
    request<{ displayName: string }>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({ displayName, password }),
    }),
  login: (password: string) =>
    request<{ displayName: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  dashboard: () => request<DashboardData>("/api/dashboard"),
};
