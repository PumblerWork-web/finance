import type {
  AuthStatus,
  BudgetPlan,
  DashboardData,
  FinanceEntry,
  FinanceEntryInput,
  FinanceReport,
  FinancialAccount,
  MortgageSplit,
  PlannerItem,
  PlannerItemInput,
  EntryKind,
  PlannerKind,
} from "./types";

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
  removeSampleData: () => request<DashboardData>("/api/sample-data", { method: "DELETE" }),
  accounts: () => request<FinancialAccount[]>("/api/accounts"),
  removeAccount: (id: number) =>
    request<FinancialAccount[]>(`/api/accounts/${id}`, { method: "DELETE" }),
  removeSampleAccount: (id: number) =>
    request<FinancialAccount[]>(`/api/accounts/${id}/sample`, { method: "DELETE" }),
  saveAccounts: (accounts: Array<Omit<FinancialAccount, "id" | "isMock">>) =>
    request<FinancialAccount[]>("/api/accounts", {
      method: "PUT",
      body: JSON.stringify({ accounts }),
    }),
  mortgage: () => request<MortgageSplit[]>("/api/mortgage"),
  saveMortgage: (loans: Array<Omit<MortgageSplit, "id" | "updatedAt">>) =>
    request<MortgageSplit[]>("/api/mortgage", {
      method: "PUT",
      body: JSON.stringify({ loans }),
    }),
  entries: (kind: EntryKind) => request<FinanceEntry[]>(`/api/entries?kind=${kind}`),
  createEntry: (entry: FinanceEntryInput) =>
    request<FinanceEntry>("/api/entries", { method: "POST", body: JSON.stringify(entry) }),
  updateEntry: (id: number, entry: FinanceEntryInput) =>
    request<FinanceEntry>(`/api/entries/${id}`, { method: "PUT", body: JSON.stringify(entry) }),
  deleteEntry: (id: number) => request<void>(`/api/entries/${id}`, { method: "DELETE" }),
  budgets: () => request<BudgetPlan[]>("/api/budgets"),
  saveBudgets: (budgets: Array<Omit<BudgetPlan, "id" | "spentCents">>) =>
    request<BudgetPlan[]>("/api/budgets", { method: "PUT", body: JSON.stringify({ budgets }) }),
  plannerItems: (kind: PlannerKind) => request<PlannerItem[]>(`/api/planner?kind=${kind}`),
  createPlannerItem: (item: PlannerItemInput) =>
    request<PlannerItem>("/api/planner", { method: "POST", body: JSON.stringify(item) }),
  updatePlannerItem: (id: number, item: PlannerItemInput) =>
    request<PlannerItem>(`/api/planner/${id}`, { method: "PUT", body: JSON.stringify(item) }),
  deletePlannerItem: (id: number) => request<void>(`/api/planner/${id}`, { method: "DELETE" }),
  report: () => request<FinanceReport>("/api/reports"),
};
