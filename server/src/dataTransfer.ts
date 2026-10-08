import type Database from "better-sqlite3";

const backupTables = {
  provider: ["id", "name", "type", "is_mock"],
  financial_account: ["id", "provider_id", "name", "type", "balance_cents", "is_mock", "institution"],
  mortgage: ["id", "name", "balance_cents", "is_mock", "interest_rate_bps", "repayment_cents", "rate_type", "repayment_frequency", "updated_at"],
  monthly_summary: ["month", "income_cents", "spending_cents", "is_mock"],
  upcoming_item: ["id", "title", "due_date", "amount_cents", "kind", "is_mock"],
  monthly_budget: ["id", "category", "spent_cents", "limit_cents", "is_mock"],
  finance_entry: ["id", "kind", "amount_cents", "category", "description", "entry_date"],
  recurring_income: ["id", "amount_cents", "category", "description", "next_date", "recurrence"],
  budget_plan: ["id", "category", "limit_cents"],
  planner_item: ["id", "kind", "name", "provider", "amount_cents", "due_date", "recurrence", "notes"],
  app_setting: ["key", "value"],
} as const;

type TableName = keyof typeof backupTables;
type BackupValue = string | number | null;
type BackupRow = Record<string, BackupValue>;
type BackupTables = Record<TableName, BackupRow[]>;

export interface FinanceBackup {
  format: "finance-dashboard-backup";
  version: 1;
  exportedAt: string;
  tables: BackupTables;
}

const deleteOrder: TableName[] = [
  "financial_account",
  "mortgage",
  "monthly_summary",
  "upcoming_item",
  "monthly_budget",
  "finance_entry",
  "recurring_income",
  "budget_plan",
  "planner_item",
  "provider",
  "app_setting",
];

export function exportBackup(db: Database.Database): FinanceBackup {
  const tables = Object.fromEntries(
    Object.entries(backupTables).map(([table, columns]) => [
      table,
      db.prepare(`SELECT ${columns.join(", ")} FROM ${table}`).all() as BackupRow[],
    ]),
  ) as BackupTables;

  return {
    format: "finance-dashboard-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export function restoreBackup(db: Database.Database, value: unknown): void {
  if (!isRecord(value) || value.format !== "finance-dashboard-backup" || value.version !== 1 || !isRecord(value.tables)) {
    throw new Error("This file is not a supported Finance Dashboard backup.");
  }

  const tables = value.tables as Record<string, unknown>;
  for (const [table, columns] of Object.entries(backupTables) as Array<[TableName, readonly string[]]>) {
    const rows = tables[table];
    if (!Array.isArray(rows) || rows.some((row) => !isValidRow(row, columns))) {
      throw new Error("This backup is incomplete or contains invalid data.");
    }
  }

  const restore = db.transaction(() => {
    for (const table of deleteOrder) db.prepare(`DELETE FROM ${table}`).run();

    for (const [table, columns] of Object.entries(backupTables) as Array<[TableName, readonly string[]]>) {
      const placeholders = columns.map(() => "?").join(", ");
      const insert = db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`);
      for (const row of tables[table] as BackupRow[]) {
        insert.run(...columns.map((column) => row[column]));
      }
    }
  });

  restore();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidRow(value: unknown, columns: readonly string[]): value is BackupRow {
  if (!isRecord(value) || Object.keys(value).length !== columns.length) return false;
  return columns.every((column) => {
    if (!Object.hasOwn(value, column)) return false;
    const item = value[column];
    return item === null || typeof item === "string" || (typeof item === "number" && Number.isFinite(item));
  });
}