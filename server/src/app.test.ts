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

test("selected budget sources add monthly committed costs by payment frequency", () => {
  const db = createDatabase(":memory:");
  const mortgage = saveMortgage(db, [{
    name: "Home loan",
    balanceCents: 20_000_000,
    interestRateBps: null,
    repaymentCents: 100_000,
    propertyName: "Home",
    propertyValueCents: 50_000_000,
    rateType: "variable",
    repaymentFrequency: "monthly",
  }])[0];
  const loan = saveLoans(db, [{
    name: "Car loan",
    lender: "Lender",
    type: "car",
    balanceCents: 5_000_000,
    interestRateBps: null,
    repaymentCents: 50_000,
    repaymentFrequency: "fortnightly",
  }])[0];
  const bill = createPlannerItem(db, {
    kind: "bill",
    name: "Power",
    provider: "Utility",
    amountCents: 10_000,
    dueDate: "2026-10-15",
    recurrence: "weekly",
    notes: "",
  });
  const policy = createPlannerItem(db, {
    kind: "insurance",
    name: "Home policy",
    provider: "Insurer",
    amountCents: 1_200_000,
    dueDate: "2026-10-15",
    recurrence: "yearly",
    propertyName: "Home",
    insuredValueCents: 50_000_000,
    notes: "",
  });
  const oneOff = createPlannerItem(db, {
    kind: "bill",
    name: "Council rates",
    provider: "Council",
    amountCents: 60_000,
    dueDate: "2026-10-25",
    recurrence: "none",
    notes: "",
  });
  createEntry(db, {
    kind: "spending",
    amountCents: 25_000,
    category: "Mortgage: Home loan",
    description: "Loan payment recorded",
    entryDate: "2026-10-15",
  });
  const saved = saveBudgets(db, [
    { category: "Mortgage: Home loan", limitCents: 200_000, sourceType: "mortgage", sourceId: mortgage.id },
    { category: "Loan: Car loan", limitCents: 200_000, sourceType: "loan", sourceId: loan.id },
    { category: "Bill: Power", limitCents: 200_000, sourceType: "bill", sourceId: bill.id },
    { category: "Insurance: Home", limitCents: 200_000, sourceType: "insurance", sourceId: policy.id },
    { category: "Bill: Council rates", limitCents: 200_000, sourceType: "bill", sourceId: oneOff.id },
    { category: "Other: Pets", limitCents: 200_000, sourceType: "other" },
  ]);

  assert.deepEqual(Object.fromEntries(saved.map((budget) => [budget.category, budget.committedCents])), {
    "Bill: Council rates": 60_000,
    "Bill: Power": 43_333,
    "Insurance: Home": 100_000,
    "Loan: Car loan": 108_333,
    "Mortgage: Home loan": 75_000,
    "Other: Pets": 0,
  });
  const mortgageBudget = saved.find((budget) => budget.category === "Mortgage: Home loan");
  assert.ok(mortgageBudget);
  assert.equal(mortgageBudget.spentCents, 25_000);
  assert.equal(mortgageBudget.spentCents + mortgageBudget.committedCents, 100_000);
  assert.equal(listBudgets(db, "2026-11").find((budget) => budget.sourceId === oneOff.id)?.committedCents, 0);
  db.close();
});

test("budget spending windows follow weekly, fortnightly, and monthly cadence", () => {
  const db = createDatabase(":memory:");
  const entries = [
    ["2026-10-01", 1000],
    ["2026-10-04", 2000],
    ["2026-10-05", 3000],
    ["2026-10-11", 4000],
    ["2026-10-12", 5000],
  ] as const;
  for (const category of ["Groceries weekly", "Groceries fortnightly", "Groceries monthly"]) {
    for (const [entryDate, amountCents] of entries) {
      createEntry(db, { kind: "spending", amountCents, category, description: "", entryDate });
    }
  }
  saveBudgets(db, [
    { category: "Groceries weekly", limitCents: 10_000, frequency: "weekly" },
    { category: "Groceries fortnightly", limitCents: 20_000, frequency: "fortnightly" },
    { category: "Groceries monthly", limitCents: 30_000, frequency: "monthly" },
  ]);

  const budgets = listBudgets(db, new Date("2026-10-07T12:00:00.000Z"));
  assert.equal(budgets.find((budget) => budget.frequency === "weekly")?.spentCents, 7_000);
  assert.equal(budgets.find((budget) => budget.frequency === "fortnightly")?.spentCents, 10_000);
  assert.equal(budgets.find((budget) => budget.frequency === "monthly")?.spentCents, 15_000);
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

test("income protection and life insurance are stored without affecting home cover", () => {
  const db = createDatabase(":memory:");
  const life = createPlannerItem(db, {
    kind: "insurance", name: "Life", provider: "Acme", amountCents: 5000, dueDate: "2030-01-01",
    recurrence: "monthly", notes: "", policyType: "life", insuredValueCents: 50_000_000,
  });
  const income = createPlannerItem(db, {
    kind: "insurance", name: "Income", provider: "Acme", amountCents: 7000, dueDate: "2030-01-01",
    recurrence: "monthly", notes: "", policyType: "income",
  });
  assert.equal(life.policyType, "life");
  assert.equal(income.policyType, "income");
  assert.equal(getDashboardData(db).propertyCoverage.length, 0);
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
    propertyName: "Home",
    insuredValueCents: 85_000_000,
    dueDate: "2026-12-01",
    recurrence: "none",
    notes: "Renewal",
  });
  saveMortgage(db, [{
    name: "Home loan",
    propertyName: "Home",
    propertyValueCents: 100_000_000,
    balanceCents: 50_000_000,
    interestRateBps: null,
    repaymentCents: null,
    rateType: "variable",
    repaymentFrequency: "monthly",
  }]);
  assert.equal(recurring.nextDueDate, "2026-10-15");
  assert.equal(monthEnd.nextDueDate, "2026-10-31");
  assert.equal(getPlannerUpcoming(db, new Date("2026-10-06T12:00:00")).length, 3);
  assert.deepEqual(getDashboardData(db, new Date("2026-10-06T12:00:00")).propertyCoverage, [{
    propertyName: "Home",
    propertyValueCents: 100_000_000,
    insuredValueCents: 85_000_000,
    gapCents: 15_000_000,
  }]);
  assert.equal(updatePlannerItem(db, oneOff.id, {
    kind: "insurance",
    name: "Updated policy",
    provider: "New insurer",
    amountCents: 125000,
    propertyName: "Home",
    insuredValueCents: 85_000_000,
    dueDate: "2026-12-15",
    recurrence: "yearly",
    notes: "Updated",
  })?.name, "Updated policy");
  assert.equal(deletePlannerItem(db, oneOff.id), true);
  assert.equal(deletePlannerItem(db, oneOff.id), false);
  db.close();
});

test("dashboard compares building cover with each named property value", () => {
  const db = createDatabase(":memory:");
  saveMortgage(db, [
    {
      name: "Home variable split",
      propertyName: "12 Smith Street",
      propertyValueCents: 100_000_000,
      balanceCents: 40_000_000,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "variable",
      repaymentFrequency: "monthly",
    },
    {
      name: "Home fixed split",
      propertyName: "12 Smith Street",
      propertyValueCents: 100_000_000,
      balanceCents: 20_000_000,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "fixed",
      repaymentFrequency: "monthly",
    },
    {
      name: "Unit loan",
      propertyName: "Unit 4",
      propertyValueCents: 50_000_000,
      balanceCents: 30_000_000,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "variable",
      repaymentFrequency: "monthly",
    },
  ]);
  for (const policy of [
    { name: "House cover", propertyName: "12 Smith Street", insuredValueCents: 85_000_000 },
    { name: "Unit cover", propertyName: "Unit 4", insuredValueCents: 60_000_000 },
  ]) {
    createPlannerItem(db, {
      kind: "insurance",
      name: policy.name,
      provider: "Insurer",
      amountCents: 100_000,
      propertyName: policy.propertyName,
      insuredValueCents: policy.insuredValueCents,
      dueDate: "2026-12-01",
      recurrence: "yearly",
      notes: "",
    });
  }

  assert.deepEqual(getDashboardData(db).propertyCoverage, [
    { propertyName: "12 Smith Street", propertyValueCents: 100_000_000, insuredValueCents: 85_000_000, gapCents: 15_000_000 },
    { propertyName: "Unit 4", propertyValueCents: 50_000_000, insuredValueCents: 60_000_000, gapCents: -10_000_000 },
  ]);
  assert.throws(() => saveMortgage(db, [
    {
      name: "Conflicting split one",
      propertyName: "Same Home",
      propertyValueCents: 50_000_000,
      balanceCents: 1,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "variable",
      repaymentFrequency: "monthly",
    },
    {
      name: "Conflicting split two",
      propertyName: "same home",
      propertyValueCents: 55_000_000,
      balanceCents: 1,
      interestRateBps: null,
      repaymentCents: null,
      rateType: "variable",
      repaymentFrequency: "monthly",
    },
  ]), /same property value/);
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
    { institution: "AustralianSuper", name: "Balanced", notes: " Member 99 ", websiteUrl: "https://www.australiansuper.com", bsb: "123456", accountNumber: "12345678", type: "super", balanceCents: 300 },
  ]).filter((account) => !account.isMock);
      assert.equal(saved.find((account) => account.name === "Balanced")?.notes, "Member 99");
  assert.equal(saved.find((account) => account.name === "Everyday")?.bsb, "123-456");
  assert.equal(saved.find((account) => account.name === "Everyday")?.accountNumber, "12345678");
  assert.equal(saved.find((account) => account.name === "Savings")?.bsb, "");
  assert.equal(saved.find((account) => account.name === "Balanced")?.websiteUrl, "https://www.australiansuper.com/");
  assert.equal(saved.find((account) => account.name === "Balanced")?.bsb, "");
  assert.equal(saved.find((account) => account.name === "Balanced")?.accountNumber, "");
  assert.throws(
    () => saveAccounts(db, [{ institution: "ME Bank", name: "Bad", bsb: "12-34", type: "cash", balanceCents: 1 }]),
    /BSB with 6 digits/,
  );
  assert.throws(
    () => saveAccounts(db, [{ institution: "ME Bank", name: "Bad", accountNumber: "12$45", type: "cash", balanceCents: 1 }]),
    /account number/,
  );
  assert.throws(
    () => saveAccounts(db, [{ institution: "Bad fund", name: "Bad", websiteUrl: "javascript:alert(1)", type: "super", balanceCents: 1 }]),
    /website URL using http or https/,
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
