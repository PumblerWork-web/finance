import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { createAuthService } from "./auth";
import { createDatabase } from "./database";
import { getDashboardData } from "./dashboard";

const currentDirectory = __dirname;
const dataDirectory = process.env.FINANCE_DATA_DIR
  ? path.resolve(process.env.FINANCE_DATA_DIR)
  : path.resolve(currentDirectory, "../../data");
const db = createDatabase(path.join(dataDirectory, "finance.sqlite"));
const auth = createAuthService(db);
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 3001);
const cookieName = "finance_session";
const loginAttempts = new Map<string, { failures: number; blockedUntil: number }>();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

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
app.listen(port, host, () => {
  console.log(`Finance dashboard API listening on http://${host}:${port}`);
  if (isProduction) {
    console.log("Open http://127.0.0.1:" + port + " in your browser.");
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

export { app, db, auth };
