import type Database from "better-sqlite3";

export interface MortgageSplit {
  id: number;
  name: string;
  propertyName: string;
  propertyValueCents: number;
  balanceCents: number;
  interestRateBps: number | null;
  repaymentCents: number | null;
  rateType: "variable" | "fixed";
  repaymentFrequency: "weekly" | "fortnightly" | "monthly";
  updatedAt: string;
}

export interface MortgageSplitInput {
  name: string;
  propertyName?: string;
  propertyValueCents?: number;
  balanceCents: number;
  interestRateBps: number | null;
  repaymentCents: number | null;
  rateType: "variable" | "fixed";
  repaymentFrequency: "weekly" | "fortnightly" | "monthly";
}

export function getMortgage(db: Database.Database): MortgageSplit[] {
  return db
    .prepare(
            `SELECT id, name, property_name AS propertyName, property_value_cents AS propertyValueCents,
              balance_cents AS balanceCents, interest_rate_bps AS interestRateBps,
              repayment_cents AS repaymentCents, rate_type AS rateType,
              repayment_frequency AS repaymentFrequency, updated_at AS updatedAt
       FROM mortgage WHERE is_mock = 0 ORDER BY id`,
    )
    .all() as MortgageSplit[];
}

export function saveMortgage(db: Database.Database, inputs: MortgageSplitInput[]): MortgageSplit[] {
  if (!inputs.length) {
    throw new Error("Add at least one loan split.");
  }
  const updatedAt = new Date().toISOString();
  const save = db.transaction(() => {
    for (const input of inputs) {
      if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) {
        throw new Error("Give each loan split a name of up to 80 characters.");
      }
      if (typeof (input.propertyName ?? "Home") !== "string" || !(input.propertyName ?? "Home").trim() || (input.propertyName ?? "Home").trim().length > 80) {
        throw new Error("Enter a property name of up to 80 characters.");
      }
      if (!Number.isSafeInteger(input.propertyValueCents ?? 0) || (input.propertyValueCents ?? 0) < 0 || (input.propertyValueCents ?? 0) > 100_000_000_000) {
        throw new Error("Enter a valid property value up to $1 billion.");
      }
      if (
        !Number.isSafeInteger(input.balanceCents) ||
        Math.abs(input.balanceCents) > 10_000_000_000
      ) {
        throw new Error("Enter a loan balance between -$100 million and $100 million.");
      }
      if (
        input.interestRateBps !== null &&
        (!Number.isSafeInteger(input.interestRateBps) || input.interestRateBps < 0 || input.interestRateBps > 10000)
      ) {
        throw new Error("Enter an interest rate between 0 and 100 percent.");
      }
      if (
        input.repaymentCents !== null &&
        (!Number.isSafeInteger(input.repaymentCents) || input.repaymentCents < 0)
      ) {
        throw new Error("Enter a valid repayment amount.");
      }
      if (!["variable", "fixed"].includes(input.rateType)) {
        throw new Error("Choose whether each loan split is variable or fixed.");
      }
      if (!["weekly", "fortnightly", "monthly"].includes(input.repaymentFrequency)) {
        throw new Error("Choose weekly, fortnightly, or monthly for the repayment frequency.");
      }
    }
    const propertyValues = new Map<string, number>();
    for (const input of inputs) {
      const propertyKey = (input.propertyName ?? "Home").trim().toLocaleLowerCase();
      const propertyValueCents = input.propertyValueCents ?? 0;
      const previous = propertyValues.get(propertyKey);
      if (previous !== undefined && previous !== propertyValueCents) {
        throw new Error("Use the same property value for all loan splits on a property.");
      }
      propertyValues.set(propertyKey, propertyValueCents);
    }

    db.prepare("DELETE FROM mortgage WHERE is_mock = 0").run();
    const insert = db.prepare(
      `INSERT INTO mortgage
         (name, balance_cents, is_mock, interest_rate_bps, repayment_cents, property_name, property_value_cents, rate_type, repayment_frequency, updated_at)
       VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    );
    inputs.forEach((input) => insert.run(
      input.name.trim(),
      input.balanceCents,
      input.interestRateBps,
      input.repaymentCents,
      (input.propertyName ?? "Home").trim(),
      input.propertyValueCents ?? 0,
      input.rateType,
      input.repaymentFrequency,
      updatedAt,
    ));
  });
  save();
  return getMortgage(db);
}
