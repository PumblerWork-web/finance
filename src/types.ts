export interface AuthStatus {
  setupRequired: boolean;
  authenticated: boolean;
  displayName: string | null;
}

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
  otherLoanCents: number;
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

export type AccountType = "cash" | "offset" | "super";

export interface FinancialAccount {
  id: number;
  institution: string;
  name: string;
  bsb: string;
  accountNumber: string;
  type: AccountType;
  balanceCents: number;
  isMock: boolean;
}

export interface MortgageSplit {
  id: number;
  name: string;
  balanceCents: number;
  interestRateBps: number | null;
  repaymentCents: number | null;
  rateType: "variable" | "fixed";
  repaymentFrequency: "weekly" | "fortnightly" | "monthly";
  updatedAt: string;
}

export type LoanType = "personal" | "car" | "student" | "other";

export interface Loan {
  id: number;
  name: string;
  lender: string;
  type: LoanType;
  balanceCents: number;
  interestRateBps: number | null;
  repaymentCents: number | null;
  repaymentFrequency: "weekly" | "fortnightly" | "monthly";
  updatedAt: string;
}

export type EntryKind = "income" | "spending";
export type PlannerKind = "bill" | "insurance";
export type Recurrence = "none" | "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";

export interface FinanceEntry {
  id: number;
  kind: EntryKind;
  amountCents: number;
  category: string;
  description: string;
  entryDate: string;
}

export interface FinanceEntryInput extends Omit<FinanceEntry, "id"> {}

export type IncomeRecurrence = Exclude<Recurrence, "none">;

export interface RecurringIncome {
  id: number;
  amountCents: number;
  category: string;
  description: string;
  nextDate: string;
  recurrence: IncomeRecurrence;
}

export interface RecurringIncomeInput extends Omit<RecurringIncome, "id"> {}

export interface BudgetPlan {
  id: number;
  category: string;
  limitCents: number;
  spentCents: number;
}

export interface PlannerItem {
  id: number;
  kind: PlannerKind;
  name: string;
  provider: string;
  amountCents: number;
  dueDate: string;
  recurrence: Recurrence;
  notes: string;
  nextDueDate: string;
}

export interface PlannerItemInput extends Omit<PlannerItem, "id" | "nextDueDate"> {}

export interface FinanceReport {
  monthly: Array<{ month: string; incomeCents: number; spendingCents: number }>;
  categories: Array<{ category: string; spendingCents: number }>;
  incomeCents: number;
  spendingCents: number;
}
