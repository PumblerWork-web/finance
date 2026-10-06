import type Database from "better-sqlite3";

export function hasSampleData(db: Database.Database): boolean {
  return Boolean(
    (
      db.prepare(`
        SELECT 1 AS found
        FROM (
          SELECT is_mock FROM financial_account
          UNION ALL SELECT is_mock FROM mortgage
          UNION ALL SELECT is_mock FROM monthly_summary
          UNION ALL SELECT is_mock FROM upcoming_item
          UNION ALL SELECT is_mock FROM monthly_budget
          UNION ALL SELECT is_mock FROM provider
        )
        WHERE is_mock = 1
        LIMIT 1
      `).get() as { found: number } | undefined
    ),
  );
}

export function removeSampleData(db: Database.Database): void {
  const remove = db.transaction(() => {
    db.prepare("DELETE FROM financial_account WHERE is_mock = 1").run();
    db.prepare("DELETE FROM provider WHERE is_mock = 1").run();
    db.prepare("DELETE FROM mortgage WHERE is_mock = 1").run();
    db.prepare("DELETE FROM monthly_summary WHERE is_mock = 1").run();
    db.prepare("DELETE FROM upcoming_item WHERE is_mock = 1").run();
    db.prepare("DELETE FROM monthly_budget WHERE is_mock = 1").run();
  });
  remove();
}
