import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthService } from "./auth";
import { createDatabase } from "./database";
import { getDashboardData } from "./dashboard";
import { getAccounts, removeAccount, saveAccounts } from "./accounts";
import { getMortgage, saveMortgage } from "./mortgage";
import { getLoans, saveLoans } from "./loans";
import { removeSampleData } from "./sampleData";
import {
  createEntry,
  createPlannerItem,
  createRecurringIncome,
  deleteEntry,
  deleteRecurringIncome,
  deletePlannerItem,
  getFinanceReport,
  getPlannerUpcoming,
  listBudgets,
  listEntries,
  listRecurringIncome,
  recurringIncomeForMonth,
  saveBudgets,
  updatePlannerItem,
  updateEntry,
} from "./finance";

test("mock dashboard totals reconcile and use the Australian financial year", () => {
  const db = createDatabase(":memory:");
  const dashboard = getDashboardData(db, new Date("2026-10-06T00:00:00.000Z"));

  assert.equal(dashboard.sampleDataPresent, true);
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

test("income and spending entries drive budgets, reports and dashboard charts", () => {
  const db = createDatabase(":memory:");
  const income = createEntry(db, {
    kind: "income",
    amountCents: 500000,
    category: "Salary",
    description: "Pay",
    entryDate: "2026-10-01",
  });
  createEntry(db, {
    kind: "spending",
    amountCents: 12500,
    category: "Groceries",
    description: "Market",
    entryDate: "2026-10-02",
  });
  createEntry(db, {
    kind: "spending",
    amountCents: 25000,
    category: "Groceries",
    description: "",
    entryDate: "2026-10-03",
  });
  assert.equal(listEntries(db, "income").length, 1);
  assert.equal(updateEntry(db, income.id, { ...income, amountCents: 600000 })?.amountCents, 600000);

  const savedBudgets = saveBudgets(db, [
    { category: "Groceries", limitCents: 100000 },
    { category: "Transport", limitCents: 50000 },
  ]);
  const groceries = savedBudgets.find((budget) => budget.category === "Groceries");
  assert.equal(groceries?.spentCents, 37500);
  assert.equal(listBudgets(db, "2026-10").length, 2);

  const report = getFinanceReport(db, new Date("2026-10-06T12:00:00"));
  assert.equal(report.incomeCents, 600000);
  assert.equal(report.spendingCents, 37500);
  assert.deepEqual(report.categories, [{ category: "Groceries", spendingCents: 37500 }]);
  const dashboard = getDashboardData(db, new Date("2026-10-06T12:00:00"));
  assert.equal(dashboard.monthlyIncomeCents, 600000);
  assert.equal(dashboard.monthlySpendingCents, 37500);
  assert.equal(dashboard.personalDataPresent, true);
  assert.equal(dashboard.spendingHistory.at(-1)?.month, "2026-10");

  assert.equal(deleteEntry(db, income.id), true);
  assert.equal(deleteEntry(db, income.id), false);
  db.close();
});

test("recurring income is scheduled, editable, and included in dashboard and report expectations", () => {
  const db = createDatabase(":memory:");
  const salary = createRecurringIncome(db, {
    amountCents: 500000,
    category: "Salary",
    description: "Fortnightly pay",
    nextDate: "2026-10-02",
    recurrence: "fortnightly",
  });
  assert.equal(listRecurringIncome(db, new Date("2026-10-06T12:00:00")).length, 1);
  assert.equal(listRecurringIncome(db, new Date("2026-10-06T12:00:00"))[0].nextDate, "2026-10-16");
  assert.equal(recurringIncomeForMonth(db, "2026-10"), 1_500_000);

  const dashboard = getDashboardData(db, new Date("2026-10-06T12:00:00"));
  assert.equal(dashboard.monthlyIncomeCents, 1_500_000);
  assert.equal(dashboard.monthlySpendingCents, 0);
  assert.equal(dashboard.personalDataPresent, true);
  assert.equal(dashboard.spendingHistory.at(-1)?.incomeCents, 1_500_000);
  assert.equal(getFinanceReport(db, new Date("2026-10-06T12:00:00")).incomeCents, 1_500_000);
  assert.equal(deleteRecurringIncome(db, salary.id), true);
  assert.equal(recurringIncomeForMonth(db, "2026-10"), 0);
  db.close();
});

test("bill and insurance recurrence calculates upcoming due dates", () => {
  const db = createDatabase(":memory:");
  const recurring = createPlannerItem(db, {
    kind: "bill",
    name: "Electricity",
    provider: "Power Co",
    amountCents: 15000,
    dueDate: "2026-01-15",
    recurrence: "monthly",
    notes: "",
  });
  const monthEnd = createPlannerItem(db, {
    kind: "bill",
    name: "Internet",
    provider: "",
    amountCents: 9000,
    dueDate: "2026-01-31",
    recurrence: "monthly",
    notes: "",
  });
  const oneOff = createPlannerItem(db, {
    kind: "insurance",
    name: "Home policy",
    provider: "Insurer",
    amountCents: 120000,
    dueDate: "2026-12-01",
    recurrence: "none",
    notes: "Renewal",
  });
  assert.equal(recurring.nextDueDate, "2026-10-15");
  assert.equal(monthEnd.nextDueDate, "2026-10-31");
  assert.equal(getPlannerUpcoming(db, new Date("2026-10-06T12:00:00")).length, 3);
  assert.equal(updatePlannerItem(db, oneOff.id, {
    kind: "insurance",
    name: "Updated policy",
    provider: "New insurer",
    amountCents: 125000,
    dueDate: "2026-12-15",
    recurrence: "yearly",
    notes: "Updated",
  })?.name, "Updated policy");
  assert.equal(deletePlannerItem(db, oneOff.id), true);
  assert.equal(deletePlannerItem(db, oneOff.id), false);
  db.close();
});

test("sample data can be removed without affecting personal data or reseeding", () => {
  const db = createDatabase(":memory:");
  saveAccounts(db, [
    { institution: "ME Bank", name: "Everyday", type: "cash", balanceCents: 125000 },
  ]);
  saveMortgage(db, [{
    name: "ME variable",
    balanceCents: 31234567,
    interestRateBps: 615,
    repaymentCents: 150000,
    rateType: "variable",
    repaymentFrequency: "fortnightly",
  }]);

  removeSampleData(db);
  const dashboard = getDashboardData(db, new Date("2026-10-06T00:00:00.000Z"));
  assert.equal(dashboard.sampleDataPresent, false);
  assert.equal(dashboard.monthlyIncomeCents, 0);
  assert.equal(dashboard.monthlySpendingCents, 0);
  assert.deepEqual(dashboard.spendingHistory, []);
  assert.deepEqual(dashboard.upcoming, []);
  assert.deepEqual(dashboard.budgets, []);
  assert.deepEqual(getAccounts(db).map(({ name, isMock }) => ({ name, isMock })), [
    { name: "Everyday", isMock: false },
  ]);
  assert.equal(getMortgage(db)[0].balanceCents, 31234567);
  assert.equal(
    (db.prepare("SELECT value FROM app_setting WHERE key = 'mock_data_seeded'").get() as { value: string }).value,
    "true",
  );
  db.close();
});

test("manual accounts support multiple institutions and replace sample totals by type", () => {
  const db = createDatabase(":memory:");
  assert.equal(getAccounts(db).length, 5);
  assert.ok(getAccounts(db).every((account) => account.isMock));

  const saved = saveAccounts(db, [
    { institution: "ME Bank", name: "Everyday", type: "cash", balanceCents: 125000 },
    { institution: "Another Bank", name: "Offset", type: "offset", balanceCents: 450000 },
    { institution: "Fund Co", name: "Super", type: "super", balanceCents: 800000 },
  ]);
  assert.equal(saved.filter((account) => !account.isMock).length, 3);
  assert.equal(new Set(saved.filter((account) => !account.isMock).map((account) => account.institution)).size, 3);

  const dashboard = getDashboardData(db, new Date("2026-10-06T00:00:00.000Z"));
  assert.equal(dashboard.accountsAreMock, false);
  assert.equal(dashboard.cashCents, 575000);
  assert.equal(dashboard.offsetCents, 450000);
  assert.equal(dashboard.superCents, 800000);

  saveAccounts(db, []);
  assert.equal(getAccounts(db).length, 5);
  assert.equal(getDashboardData(db).accountsAreMock, true);
  db.close();
});

test("manual account entries validate fields and balances", () => {
  const db = createDatabase(":memory:");
  assert.throws(
    () => saveAccounts(db, [{ institution: "", name: "Everyday", type: "cash", balanceCents: 100 }]),
    /institution or bank name/,
  );
  assert.throws(
    () => saveAccounts(db, [{ institution: "ME Bank", name: "Everyday", type: "cash", balanceCents: Number.NaN }]),
    /valid account balance/,
  );
  db.close();
});

test("accounts store BSB and account number and validate them", () => {
  const db = createDatabase(":memory:");
  const saved = saveAccounts(db, [
    { institution: "ME Bank", name: "Everyday", bsb: "123456", accountNumber: "12345678", type: "cash", balanceCents: 100 },
    { institution: "ME Bank", name: "Savings", type: "cash", balanceCents: 200 },
  ]).filter((account) => !account.isMock);
  assert.equal(saved.find((account) => account.name === "Everyday")?.bsb, "123-456");
  assert.equal(saved.find((account) => account.name === "Everyday")?.accountNumber, "12345678");
  assert.equal(saved.find((account) => account.name === "Savings")?.bsb, "");
  assert.throws(
    () => saveAccounts(db, [{ institution: "ME Bank", name: "Bad", bsb: "12-34", type: "cash", balanceCents: 1 }]),
    /BSB with 6 digits/,
  );
  assert.throws(
    () => saveAccounts(db, [{ institution: "ME Bank", name: "Bad", accountNumber: "12$45", type: "cash", balanceCents: 1 }]),
    /account number/,
  );
  db.close();
});

test("personal accounts can be deleted without affecting sample accounts", () => {
  const db = createDatabase(":memory:");
  const saved = saveAccounts(db, [
    { institution: "ME Bank", name: "Everyday", type: "cash", balanceCents: 125000 },
  ]);
  const personalId = saved.find((account) => !account.isMock)?.id;
  assert.ok(personalId);

  assert.equal(removeAccount(db, personalId), true);
  assert.equal(removeAccount(db, personalId), false);
  assert.equal(getAccounts(db).length, 5);
  assert.ok(getAccounts(db).every((account) => account.isMock));
  db.close();
});

test("manual mortgage details replace the sample loan and persist", () => {
  const db = createDatabase(":memory:");
  assert.deepEqual(getMortgage(db), []);

  const saved = saveMortgage(db, [
    {
      name: "Variable split",
      balanceCents: 31234567,
      interestRateBps: 615,
      repaymentCents: 150000,
      rateType: "variable",
      repaymentFrequency: "fortnightly",
    },
    {
      name: "Fixed split",
      balanceCents: 20000000,
      interestRateBps: 575,
      repaymentCents: 100000,
      rateType: "fixed",
      repaymentFrequency: "weekly",
    },
  ]);
  assert.equal(saved.length, 2);
  assert.deepEqual(getMortgage(db), saved);
  const dashboard = getDashboardData(db, new Date("2026-10-06T00:00:00.000Z"));
  assert.equal(dashboard.mortgageCents, 51234567);
  assert.equal(dashboard.mortgageIsMock, false);

  saveMortgage(db, [{
    name: "Updated split",
    balanceCents: 50000000,
    interestRateBps: null,
    repaymentCents: null,
    rateType: "variable",
    repaymentFrequency: "monthly",
  }]);
  assert.equal(getMortgage(db)[0].balanceCents, 50000000);
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS count FROM mortgage WHERE is_mock = 0").get() as { count: number }).count,
    1,
  );
  db.close();
});

test("manual mortgage details reject invalid values", () => {
  const db = createDatabase(":memory:");
  assert.throws(
    () => saveMortgage(db, [{
      name: "Invalid split",
      balanceCents: 10_000_000_001,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "variable",
      repaymentFrequency: "monthly",
    }]),
    /loan balance between -\$100 million and \$100 million/,
  );
  assert.throws(
    () => saveMortgage(db, [{
      name: "Invalid split",
      balanceCents: -10_000_000_001,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "variable",
      repaymentFrequency: "monthly",
    }]),
    /loan balance between -\$100 million and \$100 million/,
  );
  assert.throws(
    () => saveMortgage(db, [{
      name: "Invalid split",
      balanceCents: 100000,
      interestRateBps: 10001,
      repaymentCents: null,
      rateType: "fixed",
      repaymentFrequency: "fortnightly",
    }]),
    /interest rate between 0 and 100 percent/,
  );
  db.close();
});

test("negative mortgage splits reduce the total loan balance", () => {
  const db = createDatabase(":memory:");
  const mortgages = saveMortgage(db, [
    {
      name: "Loan balance",
      balanceCents: 20_000_000,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "variable",
      repaymentFrequency: "monthly",
    },
    {
      name: "Credit balance",
      balanceCents: -5_000_000,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "variable",
      repaymentFrequency: "monthly",
    },
  ]);

  assert.equal(mortgages[1].balanceCents, -5_000_000);
  assert.equal(getDashboardData(db).mortgageCents, 15_000_000);
  db.close();
});

test("other household loans persist and reduce net position without changing mortgage totals", () => {
  const db = createDatabase(":memory:", { seedSampleData: false });
  saveLoans(db, [{
    name: "Car finance",
    lender: "Local lender",
    type: "car",
    balanceCents: 1_500_000,
    interestRateBps: 750,
    repaymentCents: 45_000,
    repaymentFrequency: "monthly",
  }]);

  assert.equal(getLoans(db)[0].name, "Car finance");
  const dashboard = getDashboardData(db, new Date("2026-10-06T00:00:00.000Z"));
  assert.equal(dashboard.otherLoanCents, 1_500_000);
  assert.equal(dashboard.mortgageCents, 0);
  assert.equal(dashboard.netPositionCents, -1_500_000);

  saveLoans(db, []);
  assert.deepEqual(getLoans(db), []);
  db.close();
});

test("other household loans reject invalid balances", () => {
  const db = createDatabase(":memory:");
  assert.throws(() => saveLoans(db, [{
    name: "Invalid loan",
    lender: "",
    type: "personal",
    balanceCents: 0,
    interestRateBps: null,
    repaymentCents: null,
    repaymentFrequency: "monthly",
  }]), /loan balance greater than \$0/);
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
