import type Database from "better-sqlite3";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type StatementDirection = "out" | "in" | "unknown";
export type StatementDestination = "spending" | "income" | "bill";

export interface StatementTransaction {
  date: string;
  description: string;
  amountCents: number;
  direction: StatementDirection;
  category: string;
  destination: StatementDestination;
  possibleDuplicate: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/woolworths|coles|aldi|\biga\b|harris farm|supermarket/i, "Groceries"],
  [/\bbp\b|shell|ampol|caltex|7-?eleven|united petrol|fuel|petrol/i, "Fuel"],
  [/mcdonald|kfc|hungry jack|domino|uber\s*eats|menulog|doordash|cafe|coffee|restaurant|bakery|pizza/i, "Dining out"],
  [/\buber\b|opal|myki|translink|parking|linkt|toll|taxi|ola\b/i, "Transport"],
  [/\bagl\b|origin energy|energy ?australia|telstra|optus|vodafone|water|electricity|internet|nbn|synergy|alinta|powershop|dodo|tpg|belong|aussie broadband|\bcouncil\b|city of|shire of|\brates\b|water corp|sydney water|yarra valley water|actewagl|ergon|energex|\bbill\b/i, "Bills"],
  [/pharmacy|chemist|priceline|medical|doctor|dental|physio|hospital/i, "Health"],
  [/netflix|spotify|disney|youtube|apple\.com|google|stan\.com|prime video/i, "Subscriptions"],
  [/insurance|nrma|aami|allianz|medibank|bupa|hcf|youi|rac\b|raci\b|racv|racq|raa\b|hbf|nib\b/i, "Insurance"],
  [/kmart|target|big w|amazon|ebay|bunnings|jb hi-?fi|officeworks|ikea/i, "Shopping"],
  [/account fee|monthly fee|service fee|interest charge|overdrawn/i, "Bank fees"],
];

export const DEPOSIT_KEYWORD_PATTERN = /\b(?:deposit|salary|payroll|pay\/salary|direct credit|tfr from|transfer from|osko (?:from|payment from)|credit|refund|rebate|interest (?:paid|credit))\b/i;
export const WITHDRAWAL_KEYWORD_PATTERN = /\b(?:withdrawal|debit|direct debit|payment (?:to|by)|bpay|pos purchase|visa purchase|eftpos|atm|transfer to|tfr to)\b/i;

export function extractBillDetails(description: string): { name: string; provider: string } {
  let cleaned = description
    .replace(/^WITHDRAWAL\s+(?:ONLINE|MOBILE|MERCHANT)?\s*\d*\s*/i, "")
    .replace(/^PAYMENT\s+(?:BY\s+AUTHORITY\s+TO|TO)?\s*/i, "")
    .replace(/^BPAY\s+/i, "")
    .replace(/\s+\d{6,}$/i, "")
    .trim();
  if (!cleaned) cleaned = description.trim();

  let provider = "";
  if (/optus/i.test(cleaned)) provider = "Optus";
  else if (/telstra/i.test(cleaned)) provider = "Telstra";
  else if (/vodafone/i.test(cleaned)) provider = "Vodafone";
  else if (/synergy/i.test(cleaned)) provider = "Synergy";
  else if (/alinta/i.test(cleaned)) provider = "Alinta Energy";
  else if (/agl/i.test(cleaned)) provider = "AGL";
  else if (/origin/i.test(cleaned)) provider = "Origin Energy";
  else if (/water/i.test(cleaned)) provider = "Water Corporation";
  else if (/kwinana/i.test(cleaned)) provider = "City of Kwinana";
  else if (/raci?|rac\b/i.test(cleaned)) provider = "RAC";
  else provider = cleaned.split(/\s+/)[0] || "Bill";

  return { name: cleaned, provider };
}

export function guessCategory(description: string): string {
  return CATEGORY_RULES.find(([pattern]) => pattern.test(description))?.[1] ?? "Other";
}

type TextItem = { str: string; transform: number[] };

async function renderPage(page: { getTextContent: (options: object) => Promise<{ items: TextItem[] }> }): Promise<string> {
  const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
  let text = "";
  let lastY: number | undefined;
  for (const item of content.items) {
    if (lastY === undefined) text = item.str;
    else if (Math.abs(lastY - item.transform[5]) < 2) text += ` ${item.str}`;
    else text += `\n${item.str}`;
    lastY = item.transform[5];
  }
  return text;
}

export async function extractPdfText(data: Buffer): Promise<string> {
  try {
    const result = await pdfParse(data, { pagerender: renderPage });
    return result.text;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") {
      throw new Error("This PDF is password protected. Remove the password and try again.");
    }
    throw new Error("That file could not be read as a PDF.");
  }
}

interface AmountToken {
  cents: number;
  marker: "out" | "in" | null;
  signed: number;
  index: number;
}

const AMOUNT_PATTERN = /(\(?-?\s?\$?\s?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?)(?:\s?(CR|DR))?(?=\s|$)/gi;

function parseAmounts(text: string): AmountToken[] {
  const tokens: AmountToken[] = [];
  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const raw = match[1];
    const negative = /^\(|-/.test(raw);
    const digits = raw.replace(/[^\d.]/g, "");
    const cents = Math.round(Number(digits) * 100);
    if (!Number.isSafeInteger(cents)) continue;
    const suffix = match[2]?.toUpperCase();
    const marker = negative || suffix === "DR" ? "out" : suffix === "CR" ? "in" : null;
    tokens.push({ cents, marker, signed: marker === "out" ? -cents : cents, index: match.index ?? 0 });
  }
  return tokens;
}

function parseLeadingDate(line: string, defaultYear: number, now: Date): { iso: string; rest: string } | null {
  let day: number;
  let month: number;
  let year: number | null;
  let rest: string;
  let match = line.match(/^(\d{4})-(\d{2})-(\d{2})\s+(.*)$/);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    rest = match[4];
  } else if ((match = line.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\s+(.*)$/))) {
    day = Number(match[1]);
    month = Number(match[2]);
    year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    rest = match[4];
  } else if ((match = line.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?,?\s+(?:(\d{4})\s+)?(.*)$/))) {
    day = Number(match[1]);
    month = MONTHS[match[2].toLowerCase()];
    year = match[3] ? Number(match[3]) : null;
    rest = match[4];
  } else {
    return null;
  }
  if (!month || month > 12 || day < 1 || day > 31) return null;
  const resolvedYear = year ?? defaultYear;
  let date = new Date(Date.UTC(resolvedYear, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year === null && date.getTime() > now.getTime() + 31 * 86_400_000) {
    date = new Date(Date.UTC(resolvedYear - 1, month - 1, day));
  }
  return { iso: date.toISOString().slice(0, 10), rest: rest.trim() };
}

function detectYear(text: string, now: Date): number {
  const counts = new Map<number, number>();
  for (const match of text.matchAll(/\b(20\d{2})\b/g)) {
    const year = Number(match[1]);
    if (year <= now.getUTCFullYear()) counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  return best ? best[0] : now.getUTCFullYear();
}

interface RawRow {
  date: string;
  description: string;
  amount: AmountToken;
  balance: number | null;
  opening: boolean;
}

const SKIP_PATTERN = /closing balance|total (?:debits|credits|fees)|statement (?:period|date)|page \d|available (?:balance|credit)|minimum payment/i;
const OPENING_PATTERN = /opening balance|balance brought forward|brought forward/i;

export function parseStatementText(text: string, now = new Date()): Array<Omit<StatementTransaction, "possibleDuplicate">> {
  const defaultYear = detectYear(text, now);
  const rows: RawRow[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);

  for (const line of lines) {
    const dated = parseLeadingDate(line, defaultYear, now);
    if (!dated) continue;
    const tokens = parseAmounts(dated.rest);
    if (tokens.length === 0) continue;
    const description = dated.rest.slice(0, tokens[0].index).trim();
    if (OPENING_PATTERN.test(dated.rest)) {
      rows.push({ date: dated.iso, description, amount: tokens[tokens.length - 1], balance: tokens[tokens.length - 1].signed, opening: true });
      continue;
    }
    if (SKIP_PATTERN.test(dated.rest) || !description) continue;
    const hasBalance = tokens.length >= 2;
    rows.push({
      date: dated.iso,
      description: description.replace(/\s{2,}/g, " "),
      amount: hasBalance ? tokens[tokens.length - 2] : tokens[0],
      balance: hasBalance ? tokens[tokens.length - 1].signed : null,
      opening: false,
    });
  }

  const newestFirst = rows.length > 1 && rows[0].date > rows[rows.length - 1].date;
  const result: Array<Omit<StatementTransaction, "possibleDuplicate">> = [];
  rows.forEach((row, index) => {
    if (row.opening || row.amount.cents <= 0) return;
    let direction: StatementDirection = row.amount.marker ?? "unknown";
    if (direction === "unknown" && row.balance !== null) {
      const neighbour = rows[newestFirst ? index + 1 : index - 1];
      if (neighbour?.balance !== null && neighbour?.balance !== undefined) {
        const change = row.balance - neighbour.balance;
        if (change !== 0) direction = change < 0 ? "out" : "in";
      }
    }
    if (direction === "unknown") {
      if (DEPOSIT_KEYWORD_PATTERN.test(row.description)) direction = "in";
      else if (WITHDRAWAL_KEYWORD_PATTERN.test(row.description)) direction = "out";
    }
    const isDeposit = direction === "in" || DEPOSIT_KEYWORD_PATTERN.test(row.description);
    const category = isDeposit ? "Income" : guessCategory(row.description);
    const isBill = !isDeposit && (category === "Bills" || /\bbill\b|\bbpay\b|\belectricity\b|\bwater\b|\bgas\b|\benergy\b|\brates\b/i.test(row.description));
    const destination: StatementDestination = isDeposit ? "income" : isBill ? "bill" : "spending";

    result.push({
      date: row.date,
      description: row.description.slice(0, 200),
      amountCents: row.amount.cents,
      direction: isDeposit ? "in" : direction,
      category,
      destination,
    });
  });
  return result;
}

export function previewStatement(db: Database.Database, text: string, now = new Date()): StatementTransaction[] {
  const existingEntries = db.prepare(
    "SELECT kind, entry_date AS date, amount_cents AS cents FROM finance_entry",
  ).all() as Array<{ kind: string; date: string; cents: number }>;
  const existingBills = db.prepare(
    "SELECT 'bill' AS kind, due_date AS date, amount_cents AS cents FROM planner_item WHERE kind = 'bill'",
  ).all() as Array<{ kind: string; date: string; cents: number }>;
  const seen = new Set([...existingEntries, ...existingBills].map((entry) => `${entry.kind}|${entry.date}|${entry.cents}`));

  return parseStatementText(text, now).map((transaction) => {
    const expectedKind = transaction.destination === "bill" ? "bill" : transaction.destination === "income" ? "income" : "spending";
    return {
      ...transaction,
      possibleDuplicate: seen.has(`${expectedKind}|${transaction.date}|${transaction.amountCents}`),
    };
  });
}
