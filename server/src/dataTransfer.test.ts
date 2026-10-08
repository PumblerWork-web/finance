import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthService } from "./auth";
import { createDatabase } from "./database";
import { createEntry } from "./finance";
import { exportBackup, restoreBackup } from "./dataTransfer";

test("backup restores finance data without replacing the destination account", async () => {
  const source = createDatabase(":memory:");
  createEntry(source, {
    kind: "spending",
    amountCents: 4200,
    category: "Groceries",
    description: "Market",
    entryDate: "2026-10-07",
  });
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