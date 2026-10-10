import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function createDatabase(
  filename: string,
  options: { seedSampleData?: boolean } = {},
): Database.Database {
  mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_user (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS session (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS provider (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS financial_account (
      id INTEGER PRIMARY KEY,
      provider_id INTEGER REFERENCES provider(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('cash', 'offset', 'super')),
      balance_cents INTEGER NOT NULL,
      is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1)),
      institution TEXT NOT NULL DEFAULT '',
      bsb TEXT NOT NULL DEFAULT '',
      account_number TEXT NOT NULL DEFAULT '',
      website_url TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS mortgage (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      balance_cents INTEGER NOT NULL,
      is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1)),
      interest_rate_bps INTEGER,
      repayment_cents INTEGER,
      property_name TEXT NOT NULL DEFAULT 'Home',
      property_value_cents INTEGER NOT NULL DEFAULT 0,
      rate_type TEXT NOT NULL DEFAULT 'variable' CHECK (rate_type IN ('variable', 'fixed')),
      repayment_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (repayment_frequency IN ('weekly', 'fortnightly', 'monthly')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS personal_loan (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      lender TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK (type IN ('personal', 'car', 'student', 'other')),
      balance_cents INTEGER NOT NULL CHECK (balance_cents > 0),
      interest_rate_bps INTEGER,
      repayment_cents INTEGER,
      repayment_frequency TEXT NOT NULL CHECK (repayment_frequency IN ('weekly', 'fortnightly', 'monthly')),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_summary (
      month TEXT PRIMARY KEY,
      income_cents INTEGER NOT NULL,
      spending_cents INTEGER NOT NULL,
      is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS upcoming_item (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      due_date TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('bill', 'renewal')),
      is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS monthly_budget (
      id INTEGER PRIMARY KEY,
      category TEXT NOT NULL,
      spent_cents INTEGER NOT NULL,
      limit_cents INTEGER NOT NULL,
      is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS finance_entry (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('income', 'spending')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      entry_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_income (
      id INTEGER PRIMARY KEY,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      next_date TEXT NOT NULL,
      recurrence TEXT NOT NULL CHECK (recurrence IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'))
    );

    CREATE TABLE IF NOT EXISTS budget_plan (
      id INTEGER PRIMARY KEY,
      category TEXT NOT NULL UNIQUE,
      limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
      frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'fortnightly', 'monthly')),
      source_type TEXT NOT NULL DEFAULT 'other' CHECK (source_type IN ('mortgage', 'loan', 'bill', 'insurance', 'other')),
      source_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS planner_item (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('bill', 'insurance')),
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      due_date TEXT NOT NULL,
      recurrence TEXT NOT NULL CHECK (recurrence IN ('none', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
      notes TEXT NOT NULL DEFAULT '',
      property_name TEXT NOT NULL DEFAULT 'Home',
      insured_value_cents INTEGER NOT NULL DEFAULT 0,
      policy_type TEXT NOT NULL DEFAULT 'home'
    );

    CREATE TABLE IF NOT EXISTS app_setting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  ensureAccountColumns(db);
  ensureMortgageColumns(db);
  ensurePlannerColumns(db);
  ensureBudgetColumns(db);
  if (options.seedSampleData ?? true) seedMockData(db);
  return db;
}

function ensureAccountColumns(db: Database.Database): void {
  const columns = new Set(
    (db.prepare("PRAGMA table_info(financial_account)").all() as Array<{ name: string }>).map(
      ({ name }) => name,
    ),
  );
  if (!columns.has("institution")) {
    db.exec("ALTER TABLE financial_account ADD COLUMN institution TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has("bsb")) {
    db.exec("ALTER TABLE financial_account ADD COLUMN bsb TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has("account_number")) {
    db.exec("ALTER TABLE financial_account ADD COLUMN account_number TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has("website_url")) {
    db.exec("ALTER TABLE financial_account ADD COLUMN website_url TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has("notes")) {
    db.exec("ALTER TABLE financial_account ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  }
}

function ensureMortgageColumns(db: Database.Database): void {
  const columns = new Set(
    (db.prepare("PRAGMA table_info(mortgage)").all() as Array<{ name: string }>).map(
      ({ name }) => name,
    ),
  );
  if (!columns.has("interest_rate_bps")) {
    db.exec("ALTER TABLE mortgage ADD COLUMN interest_rate_bps INTEGER");
  }
  if (!columns.has("repayment_cents")) {
    db.exec("ALTER TABLE mortgage ADD COLUMN repayment_cents INTEGER");
  }
  if (!columns.has("rate_type")) {
    db.exec("ALTER TABLE mortgage ADD COLUMN rate_type TEXT NOT NULL DEFAULT 'variable'");
  }
  if (!columns.has("repayment_frequency")) {
    db.exec("ALTER TABLE mortgage ADD COLUMN repayment_frequency TEXT NOT NULL DEFAULT 'monthly'");
  }
  if (!columns.has("updated_at")) {
    db.exec("ALTER TABLE mortgage ADD COLUMN updated_at TEXT");
  }
  if (!columns.has("property_name")) {
    db.exec("ALTER TABLE mortgage ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Home'");
  }
  if (!columns.has("property_value_cents")) {
    db.exec("ALTER TABLE mortgage ADD COLUMN property_value_cents INTEGER NOT NULL DEFAULT 0");
  }
}

function ensurePlannerColumns(db: Database.Database): void {
  const columns = new Set(
    (db.prepare("PRAGMA table_info(planner_item)").all() as Array<{ name: string }>).map(
      ({ name }) => name,
    ),
  );
  if (!columns.has("property_name")) {
    db.exec("ALTER TABLE planner_item ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Home'");
  }
  if (!columns.has("insured_value_cents")) {
    db.exec("ALTER TABLE planner_item ADD COLUMN insured_value_cents INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.has("policy_type")) {
    db.exec("ALTER TABLE planner_item ADD COLUMN policy_type TEXT NOT NULL DEFAULT 'home'");
  }
}

function ensureBudgetColumns(db: Database.Database): void {
  const columns = new Set(
    (db.prepare("PRAGMA table_info(budget_plan)").all() as Array<{ name: string }>).map(
      ({ name }) => name,
    ),
  );
  if (!columns.has("frequency")) {
    db.exec("ALTER TABLE budget_plan ADD COLUMN frequency TEXT NOT NULL DEFAULT 'monthly'");
  }
  if (!columns.has("source_type")) {
    db.exec("ALTER TABLE budget_plan ADD COLUMN source_type TEXT NOT NULL DEFAULT 'other'");
  }
  if (!columns.has("source_id")) {
    db.exec("ALTER TABLE budget_plan ADD COLUMN source_id INTEGER");
  }
}

function seedMockData(db: Database.Database): void {
  const seeded = db.prepare("SELECT value FROM app_setting WHERE key = ?").get("mock_data_seeded");
  if (seeded) return;

  const seed = db.transaction(() => {
    db.prepare("INSERT INTO provider (id, name, type, is_mock) VALUES (?, ?, ?, 1)")
      .run(1, "Example bank", "bank");
    db.prepare("INSERT INTO provider (id, name, type, is_mock) VALUES (?, ?, ?, 1)")
      .run(2, "Example super fund", "super");

    const addAccount = db.prepare(
      "INSERT INTO financial_account (provider_id, name, type, balance_cents, is_mock) VALUES (?, ?, ?, ?, 1)",
    );
    addAccount.run(1, "Everyday account", "cash", 842000);
    addAccount.run(1, "Savings account", "cash", 2465000);
    addAccount.run(1, "Home offset", "offset", 3780000);
    addAccount.run(2, "Super account", "super", 9260000);
    addAccount.run(2, "Partner super", "super", 6430000);

    db.prepare("INSERT INTO mortgage (name, balance_cents, is_mock) VALUES (?, ?, 1)")
      .run("Home loan", 54800000);

    const addMonth = db.prepare(
      "INSERT INTO monthly_summary (month, income_cents, spending_cents, is_mock) VALUES (?, ?, ?, 1)",
    );
    [
      ["2026-05", 1320000, 876000],
      ["2026-06", 1290000, 820000],
      ["2026-07", 1340000, 861000],
      ["2026-08", 1310000, 829000],
      ["2026-09", 1320000, 845000],
      ["2026-10", 1320000, 845000],
    ].forEach((row) => addMonth.run(...row));

    const addUpcoming = db.prepare(
      "INSERT INTO upcoming_item (title, due_date, amount_cents, kind, is_mock) VALUES (?, ?, ?, ?, 1)",
    );
    addUpcoming.run("Electricity", "2026-10-12", 24600, "bill");
    addUpcoming.run("Home insurance", "2026-10-18", 132000, "renewal");
    addUpcoming.run("Water", "2026-10-21", 17800, "bill");

    const addBudget = db.prepare(
      "INSERT INTO monthly_budget (category, spent_cents, limit_cents, is_mock) VALUES (?, ?, ?, 1)",
    );
    addBudget.run("Groceries", 112000, 120000);
    addBudget.run("Transport", 46500, 60000);
    addBudget.run("Dining out", 38500, 40000);
    addBudget.run("Utilities", 79000, 85000);

    db.prepare("INSERT INTO app_setting (key, value) VALUES (?, ?)")
      .run("mock_data_seeded", "true");
  });

  seed();
}
