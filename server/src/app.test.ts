import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthService } from "./auth";
import { createDatabase } from "./database";
import { getDashboardData } from "./dashboard";

test("mock dashboard totals reconcile and use the Australian financial year", () => {
  const db = createDatabase(":memory:");
  const dashboard = getDashboardData(db, new Date("2026-10-06T00:00:00.000Z"));

  assert.equal(dashboard.isMock, true);
  assert.equal(dashboard.financialYear, "2026/27");
  assert.equal(dashboard.cashCents, 7_087_000);
  assert.equal(dashboard.offsetCents, 3_780_000);
  assert.equal(dashboard.superCents, 15_690_000);
  assert.equal(dashboard.mortgageCents, 54_800_000);
  assert.equal(dashboard.netPositionCents, -32_023_000);
  assert.equal(dashboard.monthlyIncomeCents, 1_320_000);
  assert.equal(dashboard.monthlySpendingCents, 845_000);
  assert.equal(dashboard.monthlySurplusCents, 475_000);
  assert.equal(dashboard.upcoming.length, 3);
  db.close();
});

test("financial year switches on 1 July", () => {
  const db = createDatabase(":memory:");
  assert.equal(getDashboardData(db, new Date("2026-06-30T12:00:00")).financialYear, "2025/26");
  assert.equal(getDashboardData(db, new Date("2026-07-01T12:00:00")).financialYear, "2026/27");
  db.close();
});

test("local account hashes passwords and sessions can be revoked", async () => {
  const db = createDatabase(":memory:");
  const auth = createAuthService(db);

  assert.equal(auth.hasUser(), false);
  await assert.rejects(auth.createUser("Alex", "short"), /12 and 256 characters/);
  await auth.createUser("Alex", "correct horse battery staple");
  assert.equal(auth.hasUser(), true);
  assert.deepEqual(await auth.verifyPassword("wrong password"), null);
  assert.deepEqual(await auth.verifyPassword("correct horse battery staple"), { displayName: "Alex" });

  const stored = db.prepare("SELECT password_hash FROM app_user WHERE id = 1").get() as {
    password_hash: string;
  };
  assert.notEqual(stored.password_hash, "correct horse battery staple");

  const { token } = auth.createSession();
  assert.deepEqual(auth.getSession(token), { displayName: "Alex" });
  auth.deleteSession(token);
  assert.equal(auth.getSession(token), null);
  db.close();
});
