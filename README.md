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

## Windows desktop installer

Install dependencies and create the Windows installer with:

```powershell
npm.cmd install
npm.cmd run build:desktop
```

The installer is written to `release/`. The app stores its database under the current Windows user's application-data folder, independently of where the program is installed. Pushing changes to the default branch also builds a downloadable installer in the GitHub Actions workflow artifacts.

### Publishing desktop updates

The installed app checks for updates on launch. When a newer version is available, it downloads the update and asks whether to restart and install it; choosing **Later** installs it the next time the app exits. Updates are distributed through GitHub Releases, which must be publicly accessible to installed copies of the app.

To publish an update, increment the `version` in `package.json`, commit and push the change, then create and push a matching version tag (for example, `v0.2.0`). The Windows desktop workflow builds the installer and publishes it to that GitHub Release. The tag version must match the package version.

## Local data and privacy

The SQLite database is created in `data/finance.sqlite` by default and is excluded from Git. Set `FINANCE_DATA_DIR` to choose a different local data directory. The account password is salted and hashed with Node.js `scrypt`; session cookies are HttpOnly, SameSite Strict, and backed by hashed session tokens in SQLite. The server binds to loopback and is not exposed to the local network.

Financial figures are seeded as fictional demo data. On the Mortgage page, add a separate loan split for each ME home-loan amount and enter its balance, optional interest rate and repayment, fixed or variable rate type, and weekly, fortnightly, or monthly repayment frequency. Negative split balances are supported and reduce the total mortgage balance. Add as many splits as needed; details stay in the local database. This is not a bank connection, and you should never enter your bank password. No real financial provider connections, analytics, or cloud services are configured.

On the Accounts page, add accounts from multiple banks or funds by entering each institution, account name, type, and balance. The Super page is a focused view for adding and updating super fund accounts. Manually entered account balances replace the sample totals for their matching account type on the dashboard.

Income and Spending accept dated entries with categories and optional notes; these entries power the dashboard cash-flow chart, monthly budgets, and Reports, and do not change account balances. Bills and Insurance support one-off or recurring entries and display the next due date. Budgets let you set monthly category limits. All sections can be edited or deleted and remain local to this device.

The Income page also supports recurring expected income (weekly, fortnightly, monthly, quarterly, or yearly). Expected payments are included in dashboard totals and reports, but are not treated as received transactions and do not update account balances.

To permanently remove fictional sample data, use **Accounts → Remove all sample data**. This deletes sample accounts, mortgage, income, spending, bills, and budgets while preserving manually entered accounts and mortgage splits. The choice is remembered locally, so sample data will not be reseeded on restart.

## Checks

```powershell
npm.cmd test
npm.cmd run build
```
