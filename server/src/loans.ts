import type Database from "better-sqlite3";

export type LoanType = "personal" | "car" | "student" | "other";
export type LoanRepaymentFrequency = "weekly" | "fortnightly" | "monthly";

export interface Loan {
  id: number;
  name: string;
  lender: string;
  type: LoanType;
  balanceCents: number;
  interestRateBps: number | null;
  repaymentCents: number | null;
  repaymentFrequency: LoanRepaymentFrequency;
  updatedAt: string;
}

export type LoanInput = Omit<Loan, "id" | "updatedAt">;

export function getLoans(db: Database.Database): Loan[] {
  return db.prepare(
    `SELECT id, name, lender, type, balance_cents AS balanceCents,
            interest_rate_bps AS interestRateBps, repayment_cents AS repaymentCents,
            repayment_frequency AS repaymentFrequency, updated_at AS updatedAt
     FROM personal_loan ORDER BY id`,
  ).all() as Loan[];
}

export function saveLoans(db: Database.Database, inputs: LoanInput[]): Loan[] {
  const updatedAt = new Date().toISOString();
  const save = db.transaction(() => {
    for (const input of inputs) validateLoan(input);

    db.prepare("DELETE FROM personal_loan").run();
    const insert = db.prepare(
      `INSERT INTO personal_loan
         (name, lender, type, balance_cents, interest_rate_bps, repayment_cents, repayment_frequency, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const input of inputs) {
      insert.run(
        input.name.trim(),
        input.lender.trim(),
        input.type,
        input.balanceCents,
        input.interestRateBps,
        input.repaymentCents,
        input.repaymentFrequency,
        updatedAt,
      );
    }
  });
  save();
  return getLoans(db);
}

function validateLoan(input: LoanInput): void {
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) {
    throw new Error("Give each loan a name of up to 80 characters.");
  }
  if (typeof input.lender !== "string" || input.lender.trim().length > 80) {
    throw new Error("Enter a lender name of up to 80 characters.");
  }
  if (!( ["personal", "car", "student", "other"] as string[]).includes(input.type)) {
    throw new Error("Choose a valid loan type.");
  }
  if (!Number.isSafeInteger(input.balanceCents) || input.balanceCents <= 0 || input.balanceCents > 10_000_000_000) {
    throw new Error("Enter a loan balance greater than $0 and no more than $100 million.");
  }
  if (
    input.interestRateBps !== null &&
    (!Number.isSafeInteger(input.interestRateBps) || input.interestRateBps < 0 || input.interestRateBps > 10000)
  ) {
    throw new Error("Enter an interest rate between 0 and 100 percent.");
  }
  if (input.repaymentCents !== null && (!Number.isSafeInteger(input.repaymentCents) || input.repaymentCents < 0)) {
    throw new Error("Enter a valid repayment amount.");
  }
  if (!( ["weekly", "fortnightly", "monthly"] as string[]).includes(input.repaymentFrequency)) {
    throw new Error("Choose weekly, fortnightly, or monthly for the repayment frequency.");
  }
}