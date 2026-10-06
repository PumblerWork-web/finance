export interface AuthStatus {
  setupRequired: boolean;
  authenticated: boolean;
  displayName: string | null;
}

export interface DashboardData {
  isMock: boolean;
  updatedAt: string;
  financialYear: string;
  netPositionCents: number;
  cashCents: number;
  offsetCents: number;
  superCents: number;
  mortgageCents: number;
  monthlyIncomeCents: number;
  monthlySpendingCents: number;
  monthlySurplusCents: number;
  spendingHistory: Array<{ month: string; incomeCents: number; spendingCents: number }>;
  upcoming: Array<{
    id: number;
    title: string;
    dueDate: string;
    amountCents: number;
    kind: "bill" | "renewal";
  }>;
  budgets: Array<{ category: string; spentCents: number; limitCents: number }>;
}
