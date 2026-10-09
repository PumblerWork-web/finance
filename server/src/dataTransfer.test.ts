import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthService } from "./auth";
import { createDatabase } from "./database";
import { createEntry } from "./finance";
import { exportBackup, restoreBackup } from "./dataTransfer";
import { getLoans, saveLoans } from "./loans";
import { listBudgets, saveBudgets } from "./finance";

test("backup restores finance data without replacing the destination account", async () => {
  const source = createDatabase(":memory:");
  createEntry(source, {
    kind: "spending",
    amountCents: 4200,
    category: "Groceries",
    description: "Market",
    entryDate: "2026-10-07",
  });
  saveLoans(source, [{
    name: "Car finance",
    lender: "Local lender",
    type: "car",
    balanceCents: 1_250_000,
    interestRateBps: 750,
    repaymentCents: 45_000,
    repaymentFrequency: "monthly",
  }]);
  const backup = exportBackup(source);
  const destination = createDatabase(":memory:", { seedSampleData: false });
  const destinationAuth = createAuthService(destination);
  await destinationAuth.createUser("New PC", "destination password 123");
  createEntry(destination, {
    kind: "income",
    amountCents: 90000,
    category: "Old data",
    description: "Replace me",
    entryDate: "2026-10-01",
  });

  restoreBackup(destination, backup);

  assert.deepEqual(exportBackup(destination).tables, backup.tables);
  assert.deepEqual(await destinationAuth.verifyPassword("destination password 123"), { displayName: "New PC" });
  assert.equal(JSON.stringify(backup).includes("app_user"), false);
  assert.equal(JSON.stringify(backup).includes("session"), false);
  source.close();
  destination.close();
});

test("version 1 backups restore without general loans", () => {
  const source = createDatabase(":memory:");
  saveBudgets(source, [{ category: "Custom spending", limitCents: 100_000 }]);
  const backup = exportBackup(source);
  for (const account of backup.tables.financial_account) delete account.website_url;
  for (const mortgage of backup.tables.mortgage) {
    delete mortgage.property_name;
    delete mortgage.property_value_cents;
  }
  for (const item of backup.tables.planner_item) {
    delete item.property_name;
    delete item.insured_value_cents;
  }
  for (const budget of backup.tables.budget_plan) {
    delete budget.source_type;
    delete budget.source_id;
  }
  const destination = createDatabase(":memory:");
  saveLoans(destination, [{
    name: "Old PC loan",
    lender: "Local lender",
    type: "personal",
    balanceCents: 100_000,
    interestRateBps: null,
    repaymentCents: null,
    repaymentFrequency: "monthly",
  }]);

  restoreBackup(destination, {
    ...backup,
    version: 1,
    tables: { ...backup.tables, personal_loan: undefined },
  });

  assert.deepEqual(getLoans(destination), []);
  assert.equal(listBudgets(destination, new Date().toISOString().slice(0, 7))[0].sourceType, "other");
  source.close();
  destination.close();
});

test("invalid backup data rolls back without deleting destination data", () => {
  const source = createDatabase(":memory:");
  const backup = exportBackup(source);
  backup.tables.financial_account[0].provider_id = 999999;
  const destination = createDatabase(":memory:");
  const before = exportBackup(destination).tables;

  assert.throws(() => restoreBackup(destination, backup), /FOREIGN KEY constraint failed/);
  assert.deepEqual(exportBackup(destination).tables, before);
  source.close();
  destination.close();
});