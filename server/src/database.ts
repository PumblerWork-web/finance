import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function createDatabase(filename: string): Database.Database {
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
      is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS mortgage (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      balance_cents INTEGER NOT NULL,
      is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1))
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

    CREATE TABLE IF NOT EXISTS app_setting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedMockData(db);
  return db;
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
