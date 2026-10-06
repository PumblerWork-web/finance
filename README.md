# Finance dashboard

A local-first household finance dashboard for Australian users. Phase 1 includes the dashboard shell, local password protection, SQLite persistence, settings, and clearly labelled sample data. The other navigation areas are roadmap placeholders; no bank or superannuation provider is connected.

## Requirements

- Node.js 22.13 or later
- npm

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local Vite address shown in the terminal (normally `http://127.0.0.1:5173`). On first run, create a local account with a password of at least 12 characters. The development API is available only on `127.0.0.1:3001`.

For a production-style local run:

```powershell
npm.cmd run build
npm.cmd start
```

Then open `http://127.0.0.1:3001`.

## Local data and privacy

The SQLite database is created in `data/finance.sqlite` by default and is excluded from Git. Set `FINANCE_DATA_DIR` to choose a different local data directory. The account password is salted and hashed with Node.js `scrypt`; session cookies are HttpOnly, SameSite Strict, and backed by hashed session tokens in SQLite. The server binds to loopback and is not exposed to the local network.

All current financial figures are fictional demo data. They are seeded once into the local database and marked as mock data. No real financial provider connections, analytics, or cloud services are configured.

## Checks

```powershell
npm.cmd test
npm.cmd run build
```
