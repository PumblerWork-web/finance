import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { createAuthService } from "./auth";
import { createDatabase } from "./database";
import { exportBackup, restoreBackup } from "./dataTransfer";
import { getDashboardData } from "./dashboard";
import { getAccounts, removeAccount, removeSampleAccount, saveAccounts, type FinancialAccountInput } from "./accounts";
import { getMortgage, saveMortgage, type MortgageSplitInput } from "./mortgage";
import { getLoans, saveLoans, type LoanInput } from "./loans";
import { removeSampleData } from "./sampleData";
import {
  createEntry,
  createPlannerItem,
  createRecurringIncome,
  deleteRecurringIncome,
  deleteEntry,
  deletePlannerItem,
  getFinanceReport,
  listBudgets,
  listEntries,
  listPlannerItems,
  listRecurringIncome,
  saveBudgets,
  updateEntry,
  updatePlannerItem,
  updateRecurringIncome,
  type BudgetInput,
  type EntryKind,
  type FinanceEntryInput,
  type PlannerItemInput,
  type PlannerKind,
  type RecurringIncomeInput,
  type Recurrence,
} from "./finance";

const currentDirectory = __dirname;
const dataDirectory = process.env.FINANCE_DATA_DIR
  ? path.resolve(process.env.FINANCE_DATA_DIR)
  : path.resolve(currentDirectory, "../../data");
const db = createDatabase(path.join(dataDirectory, "finance.sqlite"), { seedSampleData: false });
const auth = createAuthService(db);
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 3001);
const cookieName = "finance_session";
const loginAttempts = new Map<string, { failures: number; blockedUntil: number }>();

app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/auth/status", (req, res) => {
  const user = readSession(req);
  res.json({
    setupRequired: !auth.hasUser(),
    authenticated: Boolean(user),
    displayName: user?.displayName ?? null,
  });
});

app.post("/api/auth/setup", async (req, res, next) => {
  const body = req.body as { displayName?: unknown; password?: unknown };
  if (typeof body.displayName !== "string" || typeof body.password !== "string") {
    res.status(400).json({ error: "Enter your name and a password to set up the dashboard." });
    return;
  }

  try {
    await auth.createUser(body.displayName, body.password);
    issueSession(res);
    res.status(201).json({ displayName: body.displayName.trim() });
  } catch (error) {
    if (error instanceof Error && error.message === "An account has already been set up.") {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message.startsWith("Choose a password")) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message.startsWith("Enter a name")) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  const clientAddress = req.socket.remoteAddress ?? "local";
  const attempts = loginAttempts.get(clientAddress);
  if (attempts && attempts.blockedUntil > Date.now()) {
    res.status(429).json({ error: "Too many attempts. Please wait 15 minutes before trying again." });
    return;
  }
  const body = req.body as { password?: unknown };
  if (typeof body.password !== "string") {
    res.status(400).json({ error: "Enter your password." });
    return;
  }

  try {
    const user = await auth.verifyPassword(body.password);
    if (!user) {
      const failures = (attempts?.failures ?? 0) + 1;
      loginAttempts.set(clientAddress, {
        failures: failures >= 5 ? 0 : failures,
        blockedUntil: failures >= 5 ? Date.now() + 15 * 60 * 1000 : 0,
      });
      res.status(401).json({ error: "That password did not match. Please try again." });
      return;
    }
    loginAttempts.delete(clientAddress);
    issueSession(res);
    res.json({ displayName: user.displayName });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  const token = readCookie(req, cookieName);
  if (token) auth.deleteSession(token);
  res.clearCookie(cookieName, { httpOnly: true, sameSite: "strict", path: "/" });
  res.status(204).end();
});

app.get("/api/dashboard", requireAuth, (_req, res) => {
  res.json(getDashboardData(db));
});

app.get("/api/backup", requireAuth, (_req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="finance-dashboard-backup-${date}.json"`,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.send(JSON.stringify(exportBackup(db), null, 2));
});

app.post("/api/backup/restore", requireAuth, (req, res) => {
  try {
    restoreBackup(db, req.body);
    res.json(getDashboardData(db));
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "This backup could not be restored.",
    });
  }
});

app.delete("/api/sample-data", requireAuth, (_req, res) => {
  removeSampleData(db);
  res.json(getDashboardData(db));
});

app.get("/api/entries", requireAuth, (req, res) => {
  const kind = req.query.kind;
  if (kind !== "income" && kind !== "spending") {
    res.status(400).json({ error: "Choose income or spending." });
    return;
  }
  res.json(listEntries(db, kind));
});

app.get("/api/recurring-income", requireAuth, (_req, res) => {
  res.json(listRecurringIncome(db));
});

app.post("/api/recurring-income", requireAuth, (req, res, next) => {
  try {
    res.status(201).json(createRecurringIncome(db, parseRecurringIncome(req.body)));
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.put("/api/recurring-income/:id", requireAuth, (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Choose a valid recurring income item." });
    return;
  }
  try {
    const item = updateRecurringIncome(db, id, parseRecurringIncome(req.body));
    if (!item) {
      res.status(404).json({ error: "That recurring income item was not found." });
      return;
    }
    res.json(item);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.delete("/api/recurring-income/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Choose a valid recurring income item." });
    return;
  }
  if (!deleteRecurringIncome(db, id)) {
    res.status(404).json({ error: "That recurring income item was not found." });
    return;
  }
  res.status(204).end();
});

app.post("/api/entries", requireAuth, (req, res, next) => {
  try {
    res.status(201).json(createEntry(db, parseEntry(req.body)));
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.put("/api/entries/:id", requireAuth, (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Choose a valid entry." });
    return;
  }
  try {
    const entry = updateEntry(db, id, parseEntry(req.body));
    if (!entry) {
      res.status(404).json({ error: "That entry was not found." });
      return;
    }
    res.json(entry);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.delete("/api/entries/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Choose a valid entry." });
    return;
  }
  if (!deleteEntry(db, id)) {
    res.status(404).json({ error: "That entry was not found." });
    return;
  }
  res.status(204).end();
});

app.get("/api/budgets", requireAuth, (_req, res) => {
  res.json(listBudgets(db, new Date().toISOString().slice(0, 7)));
});

app.put("/api/budgets", requireAuth, (req, res, next) => {
  const body = req.body as { budgets?: unknown };
  if (!Array.isArray(body.budgets)) {
    res.status(400).json({ error: "Provide a list of budget categories." });
    return;
  }
  try {
    const budgets = body.budgets.map(parseBudget);
    res.json(saveBudgets(db, budgets));
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.get("/api/planner", requireAuth, (req, res) => {
  const kind = req.query.kind;
  if (kind !== "bill" && kind !== "insurance") {
    res.status(400).json({ error: "Choose bills or insurance." });
    return;
  }
  res.json(listPlannerItems(db, kind));
});

app.post("/api/planner", requireAuth, (req, res, next) => {
  try {
    res.status(201).json(createPlannerItem(db, parsePlannerItem(req.body)));
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.put("/api/planner/:id", requireAuth, (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Choose a valid item." });
    return;
  }
  try {
    const item = updatePlannerItem(db, id, parsePlannerItem(req.body));
    if (!item) {
      res.status(404).json({ error: "That item was not found." });
      return;
    }
    res.json(item);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.delete("/api/planner/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Choose a valid item." });
    return;
  }
  if (!deletePlannerItem(db, id)) {
    res.status(404).json({ error: "That item was not found." });
    return;
  }
  res.status(204).end();
});

app.get("/api/reports", requireAuth, (_req, res) => {
  res.json(getFinanceReport(db));
});

app.get("/api/accounts", requireAuth, (_req, res) => {
  res.json(getAccounts(db));
});

app.delete("/api/accounts/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Choose a valid account to delete." });
    return;
  }
  if (!removeAccount(db, id)) {
    res.status(404).json({ error: "That personal account was not found." });
    return;
  }
  res.json(getAccounts(db));
});

app.delete("/api/accounts/:id/sample", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Choose a valid sample account to delete." });
    return;
  }
  if (!removeSampleAccount(db, id)) {
    res.status(404).json({ error: "That sample account was not found." });
    return;
  }
  res.json(getAccounts(db));
});

app.put("/api/accounts", requireAuth, (req, res, next) => {
  const body = req.body as { accounts?: unknown };
  if (!Array.isArray(body.accounts)) {
    res.status(400).json({ error: "Provide a list of accounts." });
    return;
  }

  try {
    const accounts = body.accounts.map((item: unknown): FinancialAccountInput => {
      if (!item || typeof item !== "object") {
        throw new Error("Enter valid details for each account.");
      }
      const account = item as Record<string, unknown>;
      if (
        typeof account.institution !== "string" ||
        typeof account.name !== "string" ||
        (account.bsb !== undefined && typeof account.bsb !== "string") ||
        (account.accountNumber !== undefined && typeof account.accountNumber !== "string") ||
        typeof account.balanceCents !== "number" ||
        (account.type !== "cash" && account.type !== "offset" && account.type !== "super")
      ) {
        throw new Error("Enter valid details for each account.");
      }
      return {
        institution: account.institution,
        name: account.name,
        bsb: account.bsb as string | undefined,
        accountNumber: account.accountNumber as string | undefined,
        balanceCents: account.balanceCents,
        type: account.type,
      };
    });
    res.json(saveAccounts(db, accounts));
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.get("/api/mortgage", requireAuth, (_req, res) => {
  res.json(getMortgage(db));
});

app.put("/api/mortgage", requireAuth, (req, res, next) => {
  const body = req.body as { loans?: unknown };
  if (!Array.isArray(body.loans)) {
    res.status(400).json({ error: "Provide a list of mortgage loan splits." });
    return;
  }

  try {
    const loans = body.loans.map((loan: unknown): MortgageSplitInput => {
      if (!loan || typeof loan !== "object") {
        throw new Error("Enter valid details for each loan split.");
      }
      const split = loan as Record<string, unknown>;
      if (
        typeof split.name !== "string" ||
        typeof split.balanceCents !== "number" ||
        (split.interestRateBps !== null && typeof split.interestRateBps !== "number") ||
        (split.repaymentCents !== null && typeof split.repaymentCents !== "number") ||
        (split.rateType !== "variable" && split.rateType !== "fixed") ||
        (split.repaymentFrequency !== "weekly" &&
          split.repaymentFrequency !== "fortnightly" &&
          split.repaymentFrequency !== "monthly")
      ) {
        throw new Error("Enter valid details for each loan split.");
      }
      return {
        name: split.name,
        balanceCents: split.balanceCents,
        interestRateBps: split.interestRateBps,
        repaymentCents: split.repaymentCents,
        rateType: split.rateType,
        repaymentFrequency: split.repaymentFrequency,
      };
    });
    res.json(saveMortgage(db, loans));
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.get("/api/loans", requireAuth, (_req, res) => {
  res.json(getLoans(db));
});

app.put("/api/loans", requireAuth, (req, res, next) => {
  const body = req.body as { loans?: unknown };
  if (!Array.isArray(body.loans)) {
    res.status(400).json({ error: "Provide a list of loans." });
    return;
  }

  try {
    const loans = body.loans.map(parseLoan);
    res.json(saveLoans(db, loans));
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

if (isProduction) {
  const webDirectory = path.resolve(currentDirectory, "../../dist");
  app.use(express.static(webDirectory));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(webDirectory, "index.html")));
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(`A local application error occurred (${errorType}).`);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return null;
  }
}

function readSession(req: Request) {
  const token = readCookie(req, cookieName);
  return token ? auth.getSession(token) : null;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!readSession(req)) {
    res.status(401).json({ error: "Please sign in to view your dashboard." });
    return;
  }
  next();
}

function issueSession(res: Response): void {
  const { token, expiresAt } = auth.createSession();
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    expires: new Date(expiresAt),
  });
}

const host = "127.0.0.1";
const server = app.listen(port, host, () => {
  const address = server.address();
  const listeningPort = typeof address === "object" && address ? address.port : port;
  console.log(`Finance dashboard API listening on http://${host}:${listeningPort}`);
  if (isProduction) {
    console.log("Open http://127.0.0.1:" + listeningPort + " in your browser.");
  }
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  db.close();
  process.exit(0);
});

export { app, db, auth, server };

function parseEntry(value: unknown): FinanceEntryInput {
  if (!value || typeof value !== "object") throw new Error("Enter valid entry details.");
  const entry = value as Record<string, unknown>;
  if (
    (entry.kind !== "income" && entry.kind !== "spending") ||
    typeof entry.amountCents !== "number" ||
    typeof entry.category !== "string" ||
    typeof entry.description !== "string" ||
    typeof entry.entryDate !== "string"
  ) {
    throw new Error("Enter valid entry details.");
  }
  return {
    kind: entry.kind as EntryKind,
    amountCents: entry.amountCents,
    category: entry.category,
    description: entry.description,
    entryDate: entry.entryDate,
  };
}

function parseBudget(value: unknown): BudgetInput {
  if (!value || typeof value !== "object") throw new Error("Enter valid budget details.");
  const budget = value as Record<string, unknown>;
  if (typeof budget.category !== "string" || typeof budget.limitCents !== "number") {
    throw new Error("Enter valid budget details.");
  }
  return { category: budget.category, limitCents: budget.limitCents };
}

function parseRecurringIncome(value: unknown): RecurringIncomeInput {
  if (!value || typeof value !== "object") throw new Error("Enter valid recurring income details.");
  const item = value as Record<string, unknown>;
  if (
    typeof item.amountCents !== "number" ||
    typeof item.category !== "string" ||
    typeof item.description !== "string" ||
    typeof item.nextDate !== "string" ||
    typeof item.recurrence !== "string"
  ) {
    throw new Error("Enter valid recurring income details.");
  }
  return {
    amountCents: item.amountCents,
    category: item.category,
    description: item.description,
    nextDate: item.nextDate,
    recurrence: item.recurrence as RecurringIncomeInput["recurrence"],
  };
}

function parsePlannerItem(value: unknown): PlannerItemInput {
  if (!value || typeof value !== "object") throw new Error("Enter valid item details.");
  const item = value as Record<string, unknown>;
  if (
    (item.kind !== "bill" && item.kind !== "insurance") ||
    typeof item.name !== "string" ||
    typeof item.provider !== "string" ||
    typeof item.amountCents !== "number" ||
    typeof item.dueDate !== "string" ||
    typeof item.recurrence !== "string" ||
    typeof item.notes !== "string"
  ) {
    throw new Error("Enter valid item details.");
  }
  return {
    kind: item.kind as PlannerKind,
    name: item.name,
    provider: item.provider,
    amountCents: item.amountCents,
    dueDate: item.dueDate,
    recurrence: item.recurrence as Recurrence,
    notes: item.notes,
  };
}

function parseLoan(value: unknown): LoanInput {
  if (!value || typeof value !== "object") throw new Error("Enter valid loan details.");
  const loan = value as Record<string, unknown>;
  if (
    typeof loan.name !== "string" ||
    typeof loan.lender !== "string" ||
    typeof loan.type !== "string" ||
    typeof loan.balanceCents !== "number" ||
    (loan.interestRateBps !== null && typeof loan.interestRateBps !== "number") ||
    (loan.repaymentCents !== null && typeof loan.repaymentCents !== "number") ||
    typeof loan.repaymentFrequency !== "string"
  ) {
    throw new Error("Enter valid loan details.");
  }
  return {
    name: loan.name,
    lender: loan.lender,
    type: loan.type as LoanInput["type"],
    balanceCents: loan.balanceCents,
    interestRateBps: loan.interestRateBps,
    repaymentCents: loan.repaymentCents,
    repaymentFrequency: loan.repaymentFrequency as LoanInput["repaymentFrequency"],
  };
}
