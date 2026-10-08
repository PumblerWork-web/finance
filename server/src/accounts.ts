import type Database from "better-sqlite3";

export type AccountType = "cash" | "offset" | "super";

export interface FinancialAccount {
  id: number;
  institution: string;
  name: string;
  websiteUrl: string;
  bsb: string;
  accountNumber: string;
  type: AccountType;
  balanceCents: number;
  isMock: boolean;
}

export interface FinancialAccountInput {
  institution: string;
  name: string;
  websiteUrl?: string;
  bsb?: string;
  accountNumber?: string;
  type: AccountType;
  balanceCents: number;
}

function normaliseBsb(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const digits = typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
  if (!/^\d{6}$/.test(digits)) {
    throw new Error("Enter a BSB with 6 digits, for example 123-456.");
  }
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function normaliseAccountNumber(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,19}$/.test(text)) {
    throw new Error("Enter an account number using letters, numbers, spaces, or hyphens, up to 20 characters.");
  }
  return text;
}

function normaliseWebsiteUrl(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.trim().length > 2048) {
    throw new Error("Enter a valid fund website URL using http or https.");
  }
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error("Enter a valid fund website URL using http or https.");
  }
}

export function getAccounts(db: Database.Database): FinancialAccount[] {
  return db
    .prepare(
      `SELECT financial_account.id,
              COALESCE(NULLIF(financial_account.institution, ''), provider.name, 'Sample institution') AS institution,
              financial_account.name, financial_account.website_url AS websiteUrl,
              financial_account.bsb, financial_account.account_number AS accountNumber,
              financial_account.type,
              financial_account.balance_cents AS balanceCents,
              financial_account.is_mock AS isMock
       FROM financial_account
       LEFT JOIN provider ON provider.id = financial_account.provider_id
       ORDER BY financial_account.is_mock DESC, institution, financial_account.name`,
    )
    .all()
    .map((account) => {
      const row = account as Omit<FinancialAccount, "isMock"> & { isMock: number };
      return { ...row, isMock: Boolean(row.isMock) };
    });
}

export function saveAccounts(db: Database.Database, accounts: FinancialAccountInput[]): FinancialAccount[] {
  if (accounts.length > 100) {
    throw new Error("You can save up to 100 accounts.");
  }

  for (const account of accounts) {
    if (
      typeof account.institution !== "string" ||
      !account.institution.trim() ||
      account.institution.trim().length > 80
    ) {
      throw new Error("Enter an institution or bank name of up to 80 characters.");
    }
    if (typeof account.name !== "string" || !account.name.trim() || account.name.trim().length > 80) {
      throw new Error("Enter an account name of up to 80 characters.");
    }
    if (account.type !== "super") {
      normaliseBsb(account.bsb);
      normaliseAccountNumber(account.accountNumber);
    }
    normaliseWebsiteUrl(account.websiteUrl);
    if (!["cash", "offset", "super"].includes(account.type)) {
      throw new Error("Choose cash, offset, or super for each account.");
    }
    if (
      !Number.isSafeInteger(account.balanceCents) ||
      Math.abs(account.balanceCents) > 100_000_000_000
    ) {
      throw new Error("Enter a valid account balance up to $1 billion.");
    }
  }

  const save = db.transaction(() => {
    db.prepare("DELETE FROM financial_account WHERE is_mock = 0").run();
    const insert = db.prepare(
      `INSERT INTO financial_account (institution, name, website_url, bsb, account_number, type, balance_cents, is_mock)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    );
    for (const account of accounts) {
      insert.run(
        account.institution.trim(),
        account.name.trim(),
        normaliseWebsiteUrl(account.type === "super" ? account.websiteUrl : ""),
        account.type === "super" ? "" : normaliseBsb(account.bsb),
        account.type === "super" ? "" : normaliseAccountNumber(account.accountNumber),
        account.type,
        account.balanceCents,
      );
    }
  });
  save();
  return getAccounts(db);
}

export function removeAccount(db: Database.Database, id: number): boolean {
  const result = db.prepare("DELETE FROM financial_account WHERE id = ? AND is_mock = 0").run(id);
  return result.changes > 0;
}

export function removeSampleAccount(db: Database.Database, id: number): boolean {
  const result = db.prepare("DELETE FROM financial_account WHERE id = ? AND is_mock = 1").run(id);
  return result.changes > 0;
}
