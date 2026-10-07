import type Database from "better-sqlite3";
import { hasSampleData } from "./sampleData";
import {
  getDashboardEntryHistory,
  getPlannerUpcoming,
  listBudgets,
  listRecurringIncome,
  recurringIncomeForMonth,
} from "./finance";

export interface DashboardData {
  sampleDataPresent: boolean;
  personalDataPresent: boolean;
  mortgageIsMock: boolean;
  accountsAreMock: boolean;
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
  const accountBalances = db
    .prepare(
      `SELECT type, is_mock AS isMock, SUM(balance_cents) AS balanceCents
       FROM financial_account GROUP BY type, is_mock`,
    )
    .all() as Array<{ type: string; isMock: number; balanceCents: number }>;
  const balancesFor = (type: string) => {
    const actual = accountBalances.find((account) => account.type === type && !account.isMock);
    return actual?.balanceCents ??
      accountBalances.find((account) => account.type === type && account.isMock)?.balanceCents ??
      0;
  };
  const accountsAreMock = !accountBalances.some((account) => !account.isMock);
  const cashCents = balancesFor("cash");
  const offsetCents = balancesFor("offset");
  const superCents = balancesFor("super");
  const realMortgageExists = (db
    .prepare("SELECT 1 AS found FROM mortgage WHERE is_mock = 0 LIMIT 1")
    .get() as { found: number } | undefined);
  const mortgageIsMock = !realMortgageExists;
  const mortgageCents = (
    db
      .prepare("SELECT COALESCE(SUM(balance_cents), 0) AS balanceCents FROM mortgage WHERE is_mock = ?")
      .get(Number(mortgageIsMock)) as { balanceCents: number }
  ).balanceCents;
  const personalDataPresent = Boolean(
    (
      db.prepare(`
        SELECT 1 AS found
        FROM (
          SELECT id FROM financial_account WHERE is_mock = 0
          UNION ALL SELECT id FROM mortgage WHERE is_mock = 0
          UNION ALL SELECT id FROM finance_entry
          UNION ALL SELECT id FROM recurring_income
          UNION ALL SELECT id FROM planner_item
          UNION ALL SELECT id FROM budget_plan
        )
        LIMIT 1
      `).get() as { found: number } | undefined
    ),
  );
  const manualEntryCount = (db.prepare("SELECT COUNT(*) AS count FROM finance_entry").get() as {
    count: number;
  }).count;
  const recurringIncome = listRecurringIncome(db, now);
  const hasIncomeData = manualEntryCount > 0 || recurringIncome.length > 0;
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthly = hasIncomeData
    ? db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE 0 END), 0) AS incomeCents,
         COALESCE(SUM(CASE WHEN kind = 'spending' THEN amount_cents ELSE 0 END), 0) AS spendingCents
       FROM finance_entry WHERE substr(entry_date, 1, 7) = ?`,
    ).get(currentMonth) as { incomeCents: number; spendingCents: number }
    : db
    .prepare(
      "SELECT income_cents AS incomeCents, spending_cents AS spendingCents FROM monthly_summary WHERE month = ?",
    )
    .get(currentMonth) as { incomeCents: number; spendingCents: number } | undefined;
  const financialYearStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const financialYear = `${financialYearStart}/${String(financialYearStart + 1).slice(-2)}`;

  return {
    sampleDataPresent: hasSampleData(db),
    personalDataPresent,
    mortgageIsMock,
    accountsAreMock,
    updatedAt: now.toISOString(),
    financialYear,
    netPositionCents: cashCents + offsetCents + superCents - mortgageCents,
    cashCents: cashCents + offsetCents,
    offsetCents,
    superCents,
    mortgageCents,
    monthlyIncomeCents: (monthly?.incomeCents ?? 0) + recurringIncomeForMonth(db, currentMonth),
    monthlySpendingCents: monthly?.spendingCents ?? 0,
    monthlySurplusCents: (monthly?.incomeCents ?? 0) + recurringIncomeForMonth(db, currentMonth) - (monthly?.spendingCents ?? 0),
    spendingHistory: hasIncomeData ? getDashboardEntryHistory(db, now) : db
      .prepare(
        "SELECT month, income_cents AS incomeCents, spending_cents AS spendingCents FROM monthly_summary ORDER BY month",
      )
      .all() as DashboardData["spendingHistory"],
    upcoming: [
      ...getPlannerUpcoming(db, now),
      ...db
      .prepare(
        `SELECT id, title, due_date AS dueDate, amount_cents AS amountCents, kind
         FROM upcoming_item WHERE due_date >= ? ORDER BY due_date LIMIT 5`,
      )
      .all(now.toISOString().slice(0, 10)) as DashboardData["upcoming"],
    ].sort((left, right) => left.dueDate.localeCompare(right.dueDate)).slice(0, 5),
    budgets: listBudgets(db, currentMonth).length ? listBudgets(db, currentMonth) : db
      .prepare(
        "SELECT category, spent_cents AS spentCents, limit_cents AS limitCents FROM monthly_budget ORDER BY id",
      )
      .all() as DashboardData["budgets"],
  };
}
