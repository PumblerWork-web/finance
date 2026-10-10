import assert from "node:assert/strict";
import { test } from "node:test";
import { createDatabase } from "./database";
import { importEntries, listEntries } from "./finance";
import { extractBillDetails, guessCategory, parseStatementText, previewStatement } from "./statementImport";

const NOW = new Date("2026-10-10T00:00:00Z");

test("statement parser reads balance-based rows and infers direction", () => {
  const text = [
    "Statement period 01 Sep 2026 to 30 Sep 2026",
    "01/09/2026 Opening balance 1,000.00",
    "02/09/2026 WOOLWORTHS 1234 SYDNEY 54.20 945.80",
    "05/09/2026 SALARY ACME PTY LTD 2,000.00 2,945.80",
    "07/09/2026 BP EXPRESS 60.00 2,885.80",
    "30/09/2026 Closing balance 2,885.80",
  ].join("\n");
  const rows = parseStatementText(text, NOW);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => [row.date, row.amountCents, row.direction]), [
    ["2026-09-02", 5420, "out"],
    ["2026-09-05", 200000, "in"],
    ["2026-09-07", 6000, "out"],
  ]);
  assert.equal(rows[0].category, "Groceries");
  assert.equal(rows[2].category, "Fuel");
});

test("statement parser handles newest-first, markers, and yearless dates", () => {
  const text = [
    "Card statement 2026",
    "09 Sep Netflix.com -22.99",
    "03 Sep PAYMENT THANK YOU 500.00 CR",
    "02 Sep Cafe Roma (12.50)",
  ].join("\n");
  const rows = parseStatementText(text, NOW);
  assert.deepEqual(rows.map((row) => [row.date, row.amountCents, row.direction]), [
    ["2026-09-09", 2299, "out"],
    ["2026-09-03", 50000, "in"],
    ["2026-09-02", 1250, "out"],
  ]);
});

test("statement preview flags duplicates and bulk import saves spending", () => {
  const db = createDatabase(":memory:");
  importEntries(db, [{ kind: "spending", amountCents: 5420, category: "Groceries", description: "x", entryDate: "2026-09-02" }]);
  const preview = previewStatement(db, "02/09/2026 WOOLWORTHS 54.20 945.80\n03/09/2026 COLES 10.00 935.80", NOW);
  assert.deepEqual(preview.map((row) => row.possibleDuplicate), [true, false]);
  assert.throws(() => importEntries(db, []), /at least one/);
  assert.throws(() => importEntries(db, [{ kind: "spending", amountCents: 0, category: "A", description: "", entryDate: "2026-09-02" }]));
  assert.equal(listEntries(db, "spending").length, 1);
  assert.equal(guessCategory("Mystery shop"), "Other");
  db.close();
});

test("statement parser recognizes deposits and sets destination to income", () => {
  const text = [
    "05/10/2026 DEPOSIT ONLINE 2461520 TFR Carly PT payment 80.00",
    "06/10/2026 DIRECT CREDIT SALARY 1,500.00",
  ].join("\n");
  const rows = parseStatementText(text, NOW);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].direction, "in");
  assert.equal(rows[0].destination, "income");
  assert.equal(rows[0].category, "Income");
  assert.equal(rows[1].direction, "in");
  assert.equal(rows[1].destination, "income");
});

test("statement parser identifies bills and extractBillDetails extracts provider", () => {
  const text = [
    "08/10/2026 WITHDRAWAL MOBILE 0280997 BPAY OPTUS BILL 250.00",
    "08/10/2026 WITHDRAWAL ONLINE 1223412 BPAY SYNERGY 150.00",
    "08/10/2026 WITHDRAWAL ONLINE 6063256 BPAY Alinta Sal 50.00",
  ].join("\n");
  const rows = parseStatementText(text, NOW);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].destination, "bill");
  assert.equal(rows[0].category, "Bills");
  assert.equal(rows[1].destination, "bill");
  assert.equal(rows[2].destination, "bill");

  const detailsOptus = extractBillDetails(rows[0].description);
  assert.equal(detailsOptus.provider, "Optus");
  assert.equal(detailsOptus.name, "OPTUS BILL");

  const detailsSynergy = extractBillDetails(rows[1].description);
  assert.equal(detailsSynergy.provider, "Synergy");
  assert.equal(detailsSynergy.name, "SYNERGY");
});
