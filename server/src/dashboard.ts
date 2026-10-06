import type Database from "better-sqlite3";

export interface DashboardData {
  isMock: true;
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
  upcoming: Array<{ id: number; title: string; dueDate: string; amountCents: number; kind: "bill" | "renewal" }>;
  budgets: Array<{ category: string; spentCents: number; limitCents: number }>;
}

export function getDashboardData(db: Database.Database, now = new Date()): DashboardData {
  const accounts = db
    .prepare(
      "SELECT type, SUM(balance_cents) AS balanceCents FROM financial_account GROUP BY type",
    )
    .all() as Array<{ type: string; balanceCents: number }>;
  const balances = new Map(accounts.map(({ type, balanceCents }) => [type, balanceCents]));
  const cashCents = balances.get("cash") ?? 0;
  const offsetCents = balances.get("offset") ?? 0;
  const superCents = balances.get("super") ?? 0;
  const mortgageCents =
    (db.prepare("SELECT COALESCE(SUM(balance_cents), 0) AS balanceCents FROM mortgage").get() as {
      balanceCents: number;
    }).balanceCents;
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthly = db
    .prepare(
      "SELECT income_cents AS incomeCents, spending_cents AS spendingCents FROM monthly_summary WHERE month = ?",
    )
    .get(currentMonth) as { incomeCents: number; spendingCents: number } | undefined;
  const financialYearStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const financialYear = `${financialYearStart}/${String(financialYearStart + 1).slice(-2)}`;

  return {
    isMock: true,
    updatedAt: now.toISOString(),
    financialYear,
    netPositionCents: cashCents + offsetCents + superCents - mortgageCents,
    cashCents: cashCents + offsetCents,
    offsetCents,
    superCents,
    mortgageCents,
    monthlyIncomeCents: monthly?.incomeCents ?? 0,
    monthlySpendingCents: monthly?.spendingCents ?? 0,
    monthlySurplusCents: (monthly?.incomeCents ?? 0) - (monthly?.spendingCents ?? 0),
    spendingHistory: db
      .prepare(
        "SELECT month, income_cents AS incomeCents, spending_cents AS spendingCents FROM monthly_summary ORDER BY month",
      )
      .all() as DashboardData["spendingHistory"],
    upcoming: db
      .prepare(
        `SELECT id, title, due_date AS dueDate, amount_cents AS amountCents, kind
         FROM upcoming_item WHERE due_date >= ? ORDER BY due_date LIMIT 5`,
      )
      .all(now.toISOString().slice(0, 10)) as DashboardData["upcoming"],
    budgets: db
      .prepare(
        "SELECT category, spent_cents AS spentCents, limit_cents AS limitCents FROM monthly_budget ORDER BY id",
      )
      .all() as DashboardData["budgets"],
  };
}
