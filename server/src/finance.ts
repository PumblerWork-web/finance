import type Database from "better-sqlite3";

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

export interface FinanceEntryInput {
  kind: EntryKind;
  amountCents: number;
  category: string;
  description: string;
  entryDate: string;
}

export interface BudgetPlan {
  id: number;
  category: string;
  limitCents: number;
  spentCents: number;
}

export interface BudgetInput {
  category: string;
  limitCents: number;
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

export type PlannerItemInput = Omit<PlannerItem, "id" | "nextDueDate">;

export interface FinanceReport {
  monthly: Array<{ month: string; incomeCents: number; spendingCents: number }>;
  categories: Array<{ category: string; spendingCents: number }>;
  incomeCents: number;
  spendingCents: number;
}

function validateDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`Enter a valid ${label} date.`);
  }
}

function validateAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 100_000_000_000) {
    throw new Error(`Enter a ${label} greater than $0 and no more than $1 billion.`);
  }
}

export function listEntries(db: Database.Database, kind: EntryKind): FinanceEntry[] {
  return db.prepare(
    `SELECT id, kind, amount_cents AS amountCents, category, description, entry_date AS entryDate
     FROM finance_entry WHERE kind = ? ORDER BY entry_date DESC, id DESC`,
  ).all(kind) as FinanceEntry[];
}

export function createEntry(db: Database.Database, input: FinanceEntryInput): FinanceEntry {
  validateEntry(input);
  const result = db.prepare(
    `INSERT INTO finance_entry (kind, amount_cents, category, description, entry_date)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(input.kind, input.amountCents, input.category.trim(), input.description.trim(), input.entryDate);
  return db.prepare(
    `SELECT id, kind, amount_cents AS amountCents, category, description, entry_date AS entryDate
     FROM finance_entry WHERE id = ?`,
  ).get(result.lastInsertRowid) as FinanceEntry;
}

export function updateEntry(db: Database.Database, id: number, input: FinanceEntryInput): FinanceEntry | null {
  validateEntry(input);
  const result = db.prepare(
    `UPDATE finance_entry SET kind = ?, amount_cents = ?, category = ?, description = ?, entry_date = ?
     WHERE id = ?`,
  ).run(input.kind, input.amountCents, input.category.trim(), input.description.trim(), input.entryDate, id);
  if (!result.changes) return null;
  return db.prepare(
    `SELECT id, kind, amount_cents AS amountCents, category, description, entry_date AS entryDate
     FROM finance_entry WHERE id = ?`,
  ).get(id) as FinanceEntry;
}

export function deleteEntry(db: Database.Database, id: number): boolean {
  return db.prepare("DELETE FROM finance_entry WHERE id = ?").run(id).changes > 0;
}

function validateEntry(input: FinanceEntryInput): void {
  if (input.kind !== "income" && input.kind !== "spending") throw new Error("Choose income or spending.");
  validateAmount(input.amountCents, "amount");
  if (typeof input.category !== "string" || !input.category.trim() || input.category.trim().length > 80) {
    throw new Error("Enter a category of up to 80 characters.");
  }
  if (typeof input.description !== "string" || input.description.length > 200) {
    throw new Error("Notes must be 200 characters or fewer.");
  }
  validateDate(input.entryDate, "entry");
}

export function listBudgets(db: Database.Database, month: string): BudgetPlan[] {
  return db.prepare(
    `SELECT b.id, b.category, b.limit_cents AS limitCents,
            COALESCE(SUM(e.amount_cents), 0) AS spentCents
     FROM budget_plan b
     LEFT JOIN finance_entry e
       ON e.kind = 'spending' AND lower(e.category) = lower(b.category) AND substr(e.entry_date, 1, 7) = ?
     GROUP BY b.id, b.category, b.limit_cents
     ORDER BY b.category COLLATE NOCASE`,
  ).all(month) as BudgetPlan[];
}

export function saveBudgets(db: Database.Database, budgets: BudgetInput[]): BudgetPlan[] {
  if (budgets.length > 100) throw new Error("You can save up to 100 budget categories.");
  const seen = new Set<string>();
  for (const budget of budgets) {
    if (typeof budget.category !== "string" || !budget.category.trim() || budget.category.trim().length > 80) {
      throw new Error("Enter a budget category of up to 80 characters.");
    }
    const key = budget.category.trim().toLocaleLowerCase();
    if (seen.has(key)) throw new Error("Budget categories must be unique.");
    seen.add(key);
    validateAmount(budget.limitCents, "monthly budget");
  }
  const save = db.transaction(() => {
    db.prepare("DELETE FROM budget_plan").run();
    const insert = db.prepare("INSERT INTO budget_plan (category, limit_cents) VALUES (?, ?)");
    budgets.forEach(({ category, limitCents }) => insert.run(category.trim(), limitCents));
  });
  save();
  return listBudgets(db, new Date().toISOString().slice(0, 7));
}

export function listPlannerItems(
  db: Database.Database,
  kind: PlannerKind,
  now = new Date(),
): PlannerItem[] {
  return (db.prepare(
    `SELECT id, kind, name, provider, amount_cents AS amountCents, due_date AS dueDate,
            recurrence, notes
     FROM planner_item WHERE kind = ? ORDER BY due_date, name COLLATE NOCASE`,
  ).all(kind) as Omit<PlannerItem, "nextDueDate">[]).map((item) => ({
    ...item,
    nextDueDate: nextDueDate(item.dueDate, item.recurrence, now),
  }));
}

export function createPlannerItem(db: Database.Database, input: PlannerItemInput): PlannerItem {
  validatePlannerItem(input);
  const result = db.prepare(
    `INSERT INTO planner_item (kind, name, provider, amount_cents, due_date, recurrence, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(input.kind, input.name.trim(), input.provider.trim(), input.amountCents, input.dueDate, input.recurrence, input.notes.trim());
  const item = db.prepare(
    `SELECT id, kind, name, provider, amount_cents AS amountCents, due_date AS dueDate, recurrence, notes
     FROM planner_item WHERE id = ?`,
  ).get(result.lastInsertRowid) as Omit<PlannerItem, "nextDueDate">;
  return { ...item, nextDueDate: nextDueDate(item.dueDate, item.recurrence, new Date()) };
}

export function updatePlannerItem(db: Database.Database, id: number, input: PlannerItemInput): PlannerItem | null {
  validatePlannerItem(input);
  const result = db.prepare(
    `UPDATE planner_item SET kind = ?, name = ?, provider = ?, amount_cents = ?, due_date = ?, recurrence = ?, notes = ?
     WHERE id = ?`,
  ).run(input.kind, input.name.trim(), input.provider.trim(), input.amountCents, input.dueDate, input.recurrence, input.notes.trim(), id);
  if (!result.changes) return null;
  const item = db.prepare(
    `SELECT id, kind, name, provider, amount_cents AS amountCents, due_date AS dueDate, recurrence, notes
     FROM planner_item WHERE id = ?`,
  ).get(id) as Omit<PlannerItem, "nextDueDate">;
  return { ...item, nextDueDate: nextDueDate(item.dueDate, item.recurrence, new Date()) };
}

export function deletePlannerItem(db: Database.Database, id: number): boolean {
  return db.prepare("DELETE FROM planner_item WHERE id = ?").run(id).changes > 0;
}

function validatePlannerItem(input: PlannerItemInput): void {
  if (input.kind !== "bill" && input.kind !== "insurance") throw new Error("Choose a valid item type.");
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100) {
    throw new Error("Enter a name of up to 100 characters.");
  }
  if (typeof input.provider !== "string" || input.provider.length > 100) {
    throw new Error("Provider must be 100 characters or fewer.");
  }
  validateAmount(input.amountCents, "amount");
  validateDate(input.dueDate, "due");
  if (!["none", "weekly", "fortnightly", "monthly", "quarterly", "yearly"].includes(input.recurrence)) {
    throw new Error("Choose a valid recurrence.");
  }
  if (typeof input.notes !== "string" || input.notes.length > 300) {
    throw new Error("Notes must be 300 characters or fewer.");
  }
}

function nextDueDate(dueDate: string, recurrence: Recurrence, now: Date): string {
  const due = new Date(`${dueDate}T12:00:00`);
  if (recurrence === "none" || due >= now) return dueDate;
  const anchorDay = due.getDate();
  while (due < now) {
    if (recurrence === "weekly") due.setDate(due.getDate() + 7);
    else if (recurrence === "fortnightly") due.setDate(due.getDate() + 14);
    else if (recurrence === "monthly" || recurrence === "quarterly") {
      const monthStep = recurrence === "monthly" ? 1 : 3;
      due.setDate(1);
      due.setMonth(due.getMonth() + monthStep);
      const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
      due.setDate(Math.min(anchorDay, lastDay));
    } else if (recurrence === "yearly") {
      const year = due.getFullYear() + 1;
      const lastDay = new Date(year, due.getMonth() + 1, 0).getDate();
      due.setFullYear(year, due.getMonth(), Math.min(anchorDay, lastDay));
    }
  }
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
}

export function getFinanceReport(db: Database.Database, now = new Date()): FinanceReport {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthly = db.prepare(
    `SELECT substr(entry_date, 1, 7) AS month,
            SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE 0 END) AS incomeCents,
            SUM(CASE WHEN kind = 'spending' THEN amount_cents ELSE 0 END) AS spendingCents
     FROM finance_entry WHERE entry_date >= date(?, '-11 months', 'start of month')
     GROUP BY substr(entry_date, 1, 7) ORDER BY month`,
  ).all(`${month}-01`) as FinanceReport["monthly"];
  const totals = db.prepare(
    `SELECT SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE 0 END) AS incomeCents,
            SUM(CASE WHEN kind = 'spending' THEN amount_cents ELSE 0 END) AS spendingCents
     FROM finance_entry WHERE substr(entry_date, 1, 7) = ?`,
  ).get(month) as { incomeCents: number | null; spendingCents: number | null };
  const categories = db.prepare(
    `SELECT category, SUM(amount_cents) AS spendingCents FROM finance_entry
     WHERE kind = 'spending' AND substr(entry_date, 1, 7) = ?
     GROUP BY category ORDER BY spendingCents DESC`,
  ).all(month) as FinanceReport["categories"];
  return {
    monthly,
    categories,
    incomeCents: totals.incomeCents ?? 0,
    spendingCents: totals.spendingCents ?? 0,
  };
}

export function getDashboardEntryHistory(db: Database.Database, now = new Date()): Array<{
  month: string;
  incomeCents: number;
  spendingCents: number;
}> {
  return db.prepare(
    `SELECT substr(entry_date, 1, 7) AS month,
            SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE 0 END) AS incomeCents,
            SUM(CASE WHEN kind = 'spending' THEN amount_cents ELSE 0 END) AS spendingCents
     FROM finance_entry
     WHERE entry_date >= date(?, '-5 months', 'start of month')
     GROUP BY substr(entry_date, 1, 7) ORDER BY month`,
  ).all(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`) as Array<{
    month: string;
    incomeCents: number;
    spendingCents: number;
  }>;
}

export function getPlannerUpcoming(
  db: Database.Database,
  now = new Date(),
): Array<{ id: number; title: string; dueDate: string; amountCents: number; kind: "bill" | "renewal" }> {
  const rows = db.prepare(
    `SELECT id, name AS title, due_date AS dueDate, amount_cents AS amountCents,
            kind, recurrence FROM planner_item`,
  ).all() as Array<{
    id: number;
    title: string;
    dueDate: string;
    amountCents: number;
    kind: PlannerKind;
    recurrence: Recurrence;
  }>;
  const upcoming = rows.map((row): { id: number; title: string; dueDate: string; amountCents: number; kind: "bill" | "renewal" } => ({
    id: -row.id,
    title: row.title,
    dueDate: nextDueDate(row.dueDate, row.recurrence, now),
    amountCents: row.amountCents,
    kind: row.kind === "insurance" ? "renewal" : "bill",
  }));
  return upcoming.filter((item) => item.dueDate >= now.toISOString().slice(0, 10))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}
