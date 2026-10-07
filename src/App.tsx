import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileChartColumnIncreasing,
  HeartPulse,
  House,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  PiggyBank,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api";
import type {
  AccountType,
  AuthStatus,
  BudgetPlan,
  DashboardData,
  FinanceEntry,
  FinanceReport,
  FinancialAccount,
  IncomeRecurrence,
  MortgageSplit,
  PlannerItem,
  PlannerItemInput,
  PlannerKind,
  RecurringIncome,
  Recurrence,
} from "./types";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { label: "Accounts", icon: Wallet, group: "Finances" },
  { label: "Mortgage", icon: House, group: "Finances" },
  { label: "Super", icon: PiggyBank, group: "Finances" },
  { label: "Income", icon: Banknote, group: "Finances" },
  { label: "Spending", icon: CreditCard, group: "Planning" },
  { label: "Bills", icon: CalendarDays, group: "Planning" },
  { label: "Insurance", icon: ShieldCheck, group: "Planning" },
  { label: "Budgets", icon: ChartNoAxesCombined, group: "Planning" },
  { label: "Reports", icon: FileChartColumnIncreasing, group: "Planning" },
  { label: "Settings", icon: Settings, group: "Personal" },
];

function formatMoney(cents: number, compact = false): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(cents / 100);
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    ...options,
  }).format(new Date(`${date}T12:00:00`));
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-AU", { month: "short" }).format(
    new Date(`${month}-01T12:00:00`),
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [activePage, setActivePage] = useState("Dashboard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .authStatus()
      .then(async (status) => {
        setAuth(status);
        if (status.authenticated) setData(await api.dashboard());
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to connect to the local app.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAuthenticated() {
    const status = await api.authStatus();
    setAuth(status);
    if (status.authenticated) setData(await api.dashboard());
    setError("");
  }

  async function retryDashboard() {
    setError("");
    try {
      setData(await api.dashboard());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load your dashboard.");
    }
  }

  async function refreshDashboardData() {
    const updated = await api.dashboard();
    setData(updated);
  }

  async function handleRemoveSampleData() {
    const updated = await api.removeSampleData();
    setData(updated);
    setError("");
  }

  async function handleLogout() {
    try {
      await api.logout();
      setAuth((current) =>
        current ? { ...current, authenticated: false, displayName: null } : current,
      );
      setData(null);
      setActivePage("Dashboard");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to lock the dashboard.");
    }
  }

  if (loading) {
    return <div className="loading-screen"><span className="loading-mark" />Loading your local dashboard</div>;
  }

  if (error && !auth) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <Brand />
          <div className="auth-icon auth-icon-warning"><CircleHelp size={23} /></div>
          <h1>Can’t reach your dashboard</h1>
          <p className="auth-copy">{error}</p>
          <button className="primary-button full-button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!auth?.authenticated) {
    return <AuthGate setupRequired={auth?.setupRequired ?? true} onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="household-picker">
          <div className="household-avatar">H</div>
          <div className="household-name"><strong>Home</strong><span>Personal household</span></div>
          <ChevronDown size={15} />
        </div>
        <nav aria-label="Main navigation">
          {["Overview", "Finances", "Planning", "Personal"].map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-heading">{group}</p>
              {navigation.filter((item) => item.group === group).map(({ label, icon: Icon }) => (
                <button
                  className={`nav-link ${activePage === label ? "active" : ""}`}
                  key={label}
                  onClick={() => setActivePage(label)}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <div className="privacy-icon"><LockKeyhole size={15} /></div>
            <span><strong>Private by design</strong><small>Your data stays on this device</small></span>
          </div>
          <button className="user-menu" onClick={handleLogout}>
            <div className="user-avatar">{auth.displayName?.slice(0, 1).toUpperCase()}</div>
            <span className="user-name"><strong>{auth.displayName}</strong><small>Local account</small></span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Home</span><span className="crumb-separator">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <span className="financial-year">FY {data?.financialYear ?? "—"}</span>
            <button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <div className="topbar-divider" />
            <div className="topbar-user">{auth.displayName?.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>
        {error && data && <div className="app-error" role="alert">{error}</div>}

        {activePage === "Dashboard" ? data ? (
          <Dashboard
            data={data}
            displayName={auth.displayName ?? "there"}
            onNavigate={setActivePage}
          />
        ) : (
          <DashboardUnavailable error={error} onRetry={retryDashboard} />
        ) : activePage === "Mortgage" ? (
          <MortgagePage onSaved={(mortgages) => {
            const mortgageCents = mortgages.reduce((total, mortgage) => total + mortgage.balanceCents, 0);
            setData((current) => current ? {
              ...current,
              mortgageCents,
              mortgageIsMock: false,
              netPositionCents: current.netPositionCents + current.mortgageCents - mortgageCents,
            } : current);
          }} />
        ) : activePage === "Accounts" || activePage === "Super" ? (
          <AccountsPage
            key={activePage}
            accountType={activePage === "Super" ? "super" : null}
            onRemoveSampleData={handleRemoveSampleData}
            sampleDataPresent={data?.sampleDataPresent ?? false}
            onSaved={(accounts) => {
            const realAccounts = accounts.filter((account) => !account.isMock);
            const sampleAccounts = accounts.filter((account) => account.isMock);
            const balanceFor = (type: AccountType) => {
              const matchingReal = realAccounts.filter((account) => account.type === type);
              const matching = matchingReal.length
                ? matchingReal
                : sampleAccounts.filter((account) => account.type === type);
              return matching.reduce((total, account) => total + account.balanceCents, 0);
            };
            const cashCents = balanceFor("cash") + balanceFor("offset");
            const offsetCents = balanceFor("offset");
            const superCents = balanceFor("super");
            setData((current) => {
              if (!current) return current;
              const netPositionCents = current.netPositionCents
                - current.cashCents
                - current.superCents
                + cashCents
                + superCents;
              return {
                ...current,
                cashCents,
                offsetCents,
                superCents,
                accountsAreMock: realAccounts.length === 0,
                netPositionCents,
              };
            });
          }} />
        ) : activePage === "Income" || activePage === "Spending" ? (
          <EntriesPage key={activePage} kind={activePage === "Income" ? "income" : "spending"} onChanged={refreshDashboardData} />
        ) : activePage === "Bills" || activePage === "Insurance" ? (
          <PlannerPage key={activePage} kind={activePage === "Bills" ? "bill" : "insurance"} onChanged={refreshDashboardData} />
        ) : activePage === "Budgets" ? (
          <BudgetsPage onChanged={refreshDashboardData} />
        ) : activePage === "Reports" ? (
          <ReportsPage />
        ) : (
          activePage === "Settings" ? (
          <SettingsPage
            displayName={auth.displayName ?? ""}
            onLogout={handleLogout}
          />
          ) : (
            <ComingSoonPage page={activePage} onDashboard={() => setActivePage("Dashboard")} />
          )
        )}
        <footer className="page-footer">
          <span><LockKeyhole size={13} /> Your information is stored locally on this device</span>
          <span>Finance dashboard <span className="footer-dot">·</span> Phase 1</span>
        </footer>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><span /><span /><span /></div>
      <span>fin<span className="brand-light">ance</span></span>
    </div>
  );
}

function AuthGate({
  setupRequired,
  onAuthenticated,
}: {
  setupRequired: boolean;
  onAuthenticated: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (setupRequired && password !== confirmPassword) {
      setMessage("Your passwords don’t match.");
      return;
    }
    setSubmitting(true);
    try {
      if (setupRequired) await api.setup(displayName, password);
      else await api.login(password);
      await onAuthenticated();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Brand />
        <div className="auth-icon"><LockKeyhole size={22} /></div>
        <h1>{setupRequired ? "Make this space yours" : "Welcome back"}</h1>
        <p className="auth-copy">
          {setupRequired
            ? "Create a local password to keep your household dashboard private."
            : "Enter your local password to see your financial dashboard."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          {setupRequired && (
            <label>
              Your name
              <input autoComplete="name" maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            </label>
          )}
          <label>
            Password
            <input
              autoComplete={setupRequired ? "new-password" : "current-password"}
              minLength={setupRequired ? 12 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {setupRequired && <small>Use at least 12 characters.</small>}
          </label>
          {setupRequired && (
            <label>
              Confirm password
              <input autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
            </label>
          )}
          {message && <div className="form-error" role="alert">{message}</div>}
          <button className="primary-button full-button" disabled={submitting} type="submit">
            {submitting ? "Please wait…" : setupRequired ? "Create local account" : "Unlock dashboard"}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>
        <div className="auth-privacy"><ShieldCheck size={16} /><span>Password is securely hashed. Your data stays on this device.</span></div>
      </div>
    </div>
  );
}

function Dashboard({
  data,
  displayName,
  onNavigate,
}: {
  data: DashboardData;
  displayName: string;
  onNavigate: (page: string) => void;
}) {
  const firstName = displayName.split(/\s+/)[0] || "there";
  const currentHour = new Date().getHours();
  const salutation = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const latestMonth = data.spendingHistory.at(-1);
  const hasPersonalData = data.personalDataPresent;

  if (!data.sampleDataPresent && !hasPersonalData) {
    return (
      <div className="dashboard-page">
        <div className="welcome-row">
          <div>
            <div className="eyebrow">{dateLabel}</div>
            <h1>{salutation}, {firstName}<span className="wave">.</span></h1>
            <p className="welcome-subtitle">Your sample data has been removed.</p>
          </div>
          <span className="demo-badge no-sample-badge"><span /> NO SAMPLE DATA</span>
        </div>
        <section className="panel dashboard-empty-state">
          <span className="dashboard-empty-icon"><Wallet size={23} /></span>
          <h2>No financial details added yet</h2>
          <p>This dashboard is empty. Add your own accounts or mortgage details to see your balances here. Nothing is pre-filled with sample figures.</p>
          <div className="dashboard-empty-actions">
            <button className="primary-button" onClick={() => onNavigate("Accounts")} type="button">Add accounts <ArrowRight size={15} /></button>
            <button className="secondary-button" onClick={() => onNavigate("Mortgage")} type="button">Add mortgage</button>
          </div>
        </section>
        <div className="data-disclaimer"><CircleHelp size={15} /><span>Sample data has been permanently removed from this device. Your dashboard will show only information you enter.</span></div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{dateLabel}</div>
          <h1>{salutation}, {firstName}<span className="wave">.</span></h1>
          <p className="welcome-subtitle">Here’s your household financial snapshot.</p>
        </div>
        <span className={`demo-badge ${data.sampleDataPresent ? "" : "no-sample-badge"}`}><span />{data.sampleDataPresent ? data.accountsAreMock && data.mortgageIsMock ? "SAMPLE DATA" : "MIXED DATA" : data.personalDataPresent ? "YOUR DATA" : "NO SAMPLE DATA"}</span>
      </div>

      <section className="net-worth-card">
        <div className="net-worth-content">
          <div className="card-eyebrow light-eyebrow"><span className="status-dot" /> NET FINANCIAL POSITION</div>
          <div className="net-worth-amount">{formatMoney(data.netPositionCents)}</div>
          <p className="net-worth-description">Cash and super, less your home loan</p>
          <div className="net-worth-change"><span className="change-pill"><Check size={13} /> {data.sampleDataPresent ? "SAMPLE" : "LOCAL"}</span><span>{data.sampleDataPresent ? "includes fictional sample figures" : data.personalDataPresent ? "your manually entered financial data" : "no sample figures are loaded"}</span></div>
        </div>
        <div className="net-worth-art" aria-hidden="true">
          <div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-ring ring-three" />
          <div className="art-center"><ChartNoAxesCombined size={25} /></div>
          <span className="art-point point-one" /><span className="art-point point-two" /><span className="art-point point-three" />
        </div>
        <div className="net-worth-footer">
          <span><span className="legend-dot mint" /> Cash &amp; offset <strong>{formatMoney(data.cashCents)}</strong></span>
          <span><span className="legend-dot lavender" /> Super <strong>{formatMoney(data.superCents)}</strong></span>
          <span><span className="legend-dot coral" /> Home loan <strong>{formatMoney(data.mortgageCents)}</strong></span>
        </div>
      </section>

      <section className="metric-grid" aria-label="Monthly summary">
        <MetricCard icon={Wallet} title="Cash & offset" amount={data.cashCents} note={`Offset ${formatMoney(data.offsetCents)}`} tone="mint" />
        <MetricCard icon={PiggyBank} title="Super" amount={data.superCents} note="Combined household" tone="lavender" />
        <MetricCard icon={House} title="Mortgage" amount={data.mortgageCents} note={`${data.sampleDataPresent && data.mortgageIsMock ? "Sample loan" : data.mortgageIsMock ? "No loan entered" : "ME home loan"} · Effective ${formatMoney(data.mortgageCents - data.offsetCents)}`} tone="peach" />
        <MetricCard icon={Banknote} title="Income" amount={data.monthlyIncomeCents} note="This month" tone="blue" />
        <MetricCard icon={CreditCard} title="Spending" amount={data.monthlySpendingCents} note="This month" tone="rose" />
        <MetricCard icon={ChartNoAxesCombined} title="Surplus" amount={data.monthlySurplusCents} note="This month" tone="mint" />
      </section>

      <section className="content-grid">
        <div className="panel trend-panel">
          <div className="panel-heading">
            <div><h2>Income &amp; spending</h2><p>Your monthly household cash flow</p></div>
            <button className="subtle-select">Last 6 months <ChevronDown size={14} /></button>
          </div>
          <div className="chart-legend"><span><i className="chart-dot income-dot" /> Income</span><span><i className="chart-dot spending-dot" /> Spending</span></div>
          <div className="chart-wrap">
            {data.spendingHistory.length === 0 ? (
              <div className="dashboard-section-empty">No income or spending data entered yet.</div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.spendingHistory.slice(-6)} margin={{ top: 12, right: 5, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5d87e8" stopOpacity={0.18} /><stop offset="95%" stopColor="#5d87e8" stopOpacity={0} /></linearGradient>
                  <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd" stopOpacity={0.22} /><stop offset="95%" stopColor="#c4b5fd" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatMonth} axisLine={false} tickLine={false} tick={{ fill: "#929baa", fontSize: 12 }} dy={10} />
                <YAxis tickFormatter={(value: number) => `$${(value / 100000).toFixed(1)}k`} axisLine={false} tickLine={false} tick={{ fill: "#929baa", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="incomeCents" name="Income" stroke="#5d87e8" strokeWidth={2.5} fill="url(#incomeFill)" />
                <Area type="monotone" dataKey="spendingCents" name="Spending" stroke="#a78bfa" strokeWidth={2.5} fill="url(#spendingFill)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
          {data.spendingHistory.length > 0 && <div className="chart-summary">
            <div><span>Income this month</span><strong>{formatMoney(latestMonth?.incomeCents ?? data.monthlyIncomeCents)}</strong></div>
            <div><span>Spent this month</span><strong>{formatMoney(latestMonth?.spendingCents ?? data.monthlySpendingCents)}</strong></div>
            <div><span>Monthly surplus</span><strong className="positive">{formatMoney(data.monthlySurplusCents)}</strong></div>
          </div>}
        </div>

        <div className="panel upcoming-panel">
          <div className="panel-heading">
            <div><h2>Coming up</h2><p>Bills &amp; renewals to keep an eye on</p></div>
            <button className="circle-action" aria-label="View all upcoming items"><ArrowRight size={16} /></button>
          </div>
          <div className="upcoming-list">
            {data.upcoming.length === 0 && <div className="dashboard-section-empty">No upcoming bills or renewals entered.</div>}
            {data.upcoming.map((item) => (
              <div className="upcoming-item" key={item.id}>
                <div className={`upcoming-icon ${item.kind}`} aria-hidden="true">{item.kind === "bill" ? <CalendarDays size={17} /> : <ShieldCheck size={17} />}</div>
                <div className="upcoming-details"><strong>{item.title}</strong><span>{item.kind === "bill" ? "Bill" : "Insurance renewal"} <i /> {formatDate(item.dueDate)}</span></div>
                <strong className="upcoming-amount">{formatMoney(item.amountCents)}</strong>
              </div>
            ))}
          </div>
          <button className="text-link">View all upcoming <ArrowRight size={14} /></button>
        </div>
      </section>

      <section className="content-grid lower-grid">
        <div className="panel budget-panel">
          <div className="panel-heading">
            <div><h2>Budget check-in</h2><p>A little progress goes a long way</p></div>
            <button className="text-link compact-link">See budgets <ArrowRight size={14} /></button>
          </div>
          <div className="budget-list">
            {data.budgets.length === 0 && <div className="dashboard-section-empty">No budgets entered yet.</div>}
            {data.budgets.map((budget) => {
              const percentage = Math.min(100, Math.round((budget.spentCents / budget.limitCents) * 100));
              return (
                <div className="budget-row" key={budget.category}>
                  <div className="budget-topline"><strong>{budget.category}</strong><span>{formatMoney(budget.spentCents)} <i>of</i> {formatMoney(budget.limitCents)}</span></div>
                  <div className="budget-track"><span className={percentage >= 95 ? "near-limit" : ""} style={{ width: `${percentage}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel snapshot-panel">
          <div className="panel-heading">
            <div><h2>This month at a glance</h2><p>A quick check on your financial rhythm</p></div>
          </div>
          <div className="snapshot-list">
            <div><span className="snapshot-icon income-snapshot"><ArrowDownRight size={16} /></span><span className="snapshot-label">Household income</span><strong>{formatMoney(data.monthlyIncomeCents)}</strong></div>
            <div><span className="snapshot-icon spending-snapshot"><ArrowUpRight size={16} /></span><span className="snapshot-label">Household spending</span><strong>{formatMoney(data.monthlySpendingCents)}</strong></div>
            <div><span className="snapshot-icon surplus-snapshot"><Check size={16} /></span><span className="snapshot-label">Left over</span><strong className="positive">{formatMoney(data.monthlySurplusCents)}</strong></div>
          </div>
          {data.spendingHistory.length > 0 && data.monthlyIncomeCents > 0
            ? <div className="snapshot-note"><span className="note-sparkle">✦</span><span>You kept <strong>{Math.round((data.monthlySurplusCents / data.monthlyIncomeCents) * 100)}%</strong> of household income this month.</span></div>
            : <div className="dashboard-section-empty snapshot-empty">No monthly income or spending entered yet.</div>}
        </div>
      </section>

      <div className="data-disclaimer"><CircleHelp size={15} /><span>{data.sampleDataPresent ? data.accountsAreMock && data.mortgageIsMock ? "These are fictional sample figures. Remove them at any time in Settings." : `Some dashboard data is manually entered${data.accountsAreMock ? "" : " for your accounts"}${data.mortgageIsMock ? "" : " and mortgage"}; remaining figures are samples. Remove samples in Settings.` : !data.accountsAreMock || !data.mortgageIsMock ? "Sample data has been removed. Only manually entered account and mortgage balances are shown; other sections are empty." : "Sample data has been removed. Add your own account or mortgage details to see them here."}</span><span className="updated-at">Updated {new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(new Date(data.updatedAt))}</span></div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  amount,
  note,
  tone,
}: {
  icon: typeof Wallet;
  title: string;
  amount: number;
  note: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span className={`metric-icon ${tone}`}><Icon size={17} strokeWidth={1.8} /></span><span className="metric-title">{title}</span><ArrowUpRight className="metric-trend" size={15} /></div>
      <strong className="metric-amount">{formatMoney(amount, true)}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label ? formatMonth(label) : ""}</strong>
      {payload.map((item) => <span key={item.name}><i style={{ backgroundColor: item.color }} />{item.name}<b>{formatMoney(item.value)}</b></span>)}
    </div>
  );
}

function SettingsPage({
  displayName,
  onLogout,
}: {
  displayName: string;
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="secondary-page">
      <div className="welcome-row"><div><div className="eyebrow">PERSONALISE YOUR SPACE</div><h1>Settings</h1><p className="welcome-subtitle">Your dashboard preferences and local security.</p></div></div>
      <section className="panel settings-panel">
        <div className="settings-section-title"><div className="settings-section-icon"><Settings size={18} /></div><div><h2>Profile</h2><p>Details for your local household account.</p></div></div>
        <label className="settings-field">Display name<input value={displayName} readOnly /></label>
        <div className="settings-divider" />
        <div className="settings-section-title"><div className="settings-section-icon security-setting-icon"><ShieldCheck size={18} /></div><div><h2>Privacy &amp; security</h2><p>Your dashboard is only available on this computer.</p></div></div>
        <div className="security-status"><span><LockKeyhole size={17} /></span><div><strong>Password protection is on</strong><small>Your password is securely hashed and never stored as plain text.</small></div><span className="enabled-pill"><Check size={13} /> Enabled</span></div>
        <div className="security-status"><span><House size={17} /></span><div><strong>Local-only connection</strong><small>The app listens on this computer and is not exposed to your network.</small></div><span className="enabled-pill"><Check size={13} /> Private</span></div>
        <div className="settings-divider" />
        <div className="settings-section-title"><div className="settings-section-icon"><HeartPulse size={18} /></div><div><h2>Financial year</h2><p>Australian financial year runs from 1 July to 30 June.</p></div></div>
        <div className="settings-readonly"><span>Financial year</span><strong>Australian (July – June)</strong></div>
        <div className="settings-actions">
          <button className="secondary-button" onClick={async () => { await onLogout(); }}>Lock dashboard <LogOut size={15} /></button>
          <span className="settings-readonly-note">More profile options are coming in a later phase.</span>
        </div>
      </section>
      <div className="settings-next"><span><Settings size={17} /></span><div><strong>More settings are coming soon</strong><p>Provider connections, imports, backups and retirement assumptions will be added in later phases.</p></div></div>
    </div>
  );
}

interface AccountDraft {
  accountId?: number;
  institution: string;
  name: string;
  type: AccountType;
  balance: string;
}

function newAccountDraft(type: AccountType = "cash"): AccountDraft {
  return { institution: "", name: "", type, balance: "" };
}

function AccountsPage({
  accountType,
  onRemoveSampleData,
  sampleDataPresent,
  onSaved,
}: {
  accountType: AccountType | null;
  onRemoveSampleData: () => Promise<void>;
  sampleDataPresent: boolean;
  onSaved: (accounts: FinancialAccount[]) => void;
}) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [drafts, setDrafts] = useState<AccountDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [removingSamples, setRemovingSamples] = useState(false);

  useEffect(() => {
    api.accounts()
      .then((loaded) => {
        setAccounts(loaded);
        setDrafts(loaded.filter((account) =>
          !account.isMock && (accountType === null || account.type === accountType),
        ).map((account) => ({
          accountId: account.id,
          institution: account.institution,
          name: account.name,
          type: account.type,
          balance: (account.balanceCents / 100).toFixed(2),
        })));
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to load your accounts.");
      })
      .finally(() => setLoading(false));
  }, [accountType]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const editedAccounts = drafts.map((account) => ({
        institution: account.institution,
        name: account.name,
        type: account.type,
        balanceCents: Math.round(Number(account.balance) * 100),
      }));
      const unchangedAccounts = accountType === null
        ? []
        : accounts
          .filter((account) => !account.isMock && account.type !== accountType)
          .map(({ institution, name, type, balanceCents }) => ({
            institution,
            name,
            type,
            balanceCents,
          }));
      const updated = await api.saveAccounts([...unchangedAccounts, ...editedAccounts]);
      setAccounts(updated);
      setMessage("Your accounts have been saved on this device.");
      onSaved(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your accounts.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(account: FinancialAccount) {
    const confirmMessage = account.isMock
      ? `Remove the sample account “${account.name}” from ${account.institution}? This removes only that sample account.`
      : `Delete “${account.name}” from ${account.institution}? This cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;
    setError("");
    setMessage("");
    try {
      const updated = account.isMock
        ? await api.removeSampleAccount(account.id)
        : await api.removeAccount(account.id);
      setAccounts(updated);
      setDrafts((current) => current.filter((draft) => draft.accountId !== account.id));
      setMessage(`${account.name} has been deleted.`);
      onSaved(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this account.");
    }
  }

  async function removeAllSamples() {
    if (!sampleDataPresent || removingSamples) return;
    const confirmed = window.confirm(
      "Permanently remove all fictional sample accounts, mortgage, income, spending, bills and budgets? Your manually entered accounts and mortgage splits will be kept.",
    );
    if (!confirmed) return;
    setRemovingSamples(true);
    setError("");
    setMessage("");
    try {
      await onRemoveSampleData();
      const updated = await api.accounts();
      setAccounts(updated);
      setMessage("All sample data has been removed. Your manually entered accounts were kept.");
      onSaved(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to remove sample data.");
    } finally {
      setRemovingSamples(false);
    }
  }

  const accountTypeLabel = (type: AccountType) => ({
    cash: "Cash",
    offset: "Offset",
    super: "Super",
  })[type];
  const visibleAccounts = accountType === null
    ? accounts
    : accounts.filter((account) => account.type === accountType);
  const pageTitle = accountType === "super" ? "Super" : "Accounts";
  const subtitle = accountType === "super"
    ? "View and update your superannuation accounts and balances."
    : "Keep accounts from multiple banks and funds together in one place.";

  return (
    <div className="secondary-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{accountType === "super" ? "YOUR SUPERANNUATION" : "YOUR FINANCIAL ACCOUNTS"}</div>
          <h1>{pageTitle}</h1>
          <p className="welcome-subtitle">{subtitle}</p>
        </div>
      </div>
      <section className="panel accounts-panel">
        <div className="mortgage-notice">
          <LockKeyhole size={17} />
          <p><strong>Manual entry only</strong><span>{accountType === "super" ? "Add your super fund and account details here. This does not connect to your fund; never enter account passwords." : "Add the institution and account name for each account. This does not connect to your bank; never enter banking passwords."}</span></p>
        </div>
        {accountType === null && sampleDataPresent && (
          <div className="accounts-sample-warning">
            <div>
              <strong>Sample accounts are not real</strong>
              <span>Remove all fictional sample data from every tab. Your manually entered data is kept.</span>
            </div>
            <button className="remove-sample-button" disabled={removingSamples} onClick={() => void removeAllSamples()} type="button">
              {removingSamples ? "Removing…" : "Remove all sample data"}
            </button>
          </div>
        )}
        <div className="accounts-list">
          <h2>{accountType === "super" ? "Super accounts on this device" : "Accounts on this device"}</h2>
          {loading ? <p className="mortgage-status">Loading accounts…</p> : accounts.length === 0 ? (
            <p className="mortgage-status">No accounts to show yet. Add one below to get started.</p>
          ) : visibleAccounts.length === 0 ? (
            <p className="mortgage-status">No super accounts added yet. Add a super fund below to get started.</p>
          ) : visibleAccounts.map((account) => (
            <article className={`account-card ${account.isMock ? "sample-account" : ""}`} key={`${account.isMock ? "sample" : "saved"}-${account.id}`}>
              <span className="account-card-icon"><Building2 size={17} /></span>
              <div className="account-card-info">
                <strong>{account.name}</strong>
                <span>{account.institution || "Sample institution"} · {accountTypeLabel(account.type)}</span>
              </div>
              <strong className="account-card-balance">{formatMoney(account.balanceCents)}</strong>
              {account.isMock && <span className="sample-account-tag">SAMPLE</span>}
              <button className="account-delete-button" onClick={() => void deleteAccount(account)} type="button">{account.isMock ? "Remove sample" : "Delete"}</button>
            </article>
          ))}
        </div>
        <div className="accounts-divider" />
        <form className="accounts-form" onSubmit={submit}>
          <div className="accounts-form-heading">
            <div><h2>{accountType === "super" ? "Your super funds" : "Your accounts"}</h2><p>{accountType === "super" ? "Add one entry for each super fund account." : "Add an account for each bank, offset account, or super fund."}</p></div>
            <button className="secondary-button add-split-button" disabled={loading} onClick={() => setDrafts((current) => [...current, newAccountDraft(accountType ?? "cash")])} type="button">{accountType === "super" ? "+ Add super account" : "+ Add account"}</button>
          </div>
          {drafts.length === 0 && <p className="mortgage-status">No personal accounts added. Use “Add account” to add one.</p>}
          {drafts.map((account, index) => (
            <fieldset className="account-edit-card" key={index}>
              <legend>{accountType === "super" ? `Super account ${index + 1}` : `Account ${index + 1}`}</legend>
              <button className="remove-split-button" onClick={() => setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>
              <label>
                Bank or institution
                <input autoComplete="organization" maxLength={80} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, institution: event.target.value } : item))} placeholder="e.g. ME Bank" required value={account.institution} />
              </label>
              <label>
                Account name
                <input maxLength={80} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="e.g. Everyday account" required value={account.name} />
              </label>
              <label>
                Account type
                <select onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as AccountType } : item))} value={account.type}>
                  {accountType === "super" ? (
                    <option value="super">Super</option>
                  ) : (
                    <>
                      <option value="cash">Cash or savings</option>
                      <option value="offset">Mortgage offset</option>
                      <option value="super">Super</option>
                    </>
                  )}
                </select>
              </label>
              <label>
                Balance (AUD)
                <span className="money-input"><span>$</span><input inputMode="decimal" max="1000000000" min="-1000000000" onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, balance: event.target.value } : item))} placeholder="e.g. 5,000" required step="0.01" type="number" value={account.balance} /></span>
              </label>
            </fieldset>
          ))}
          {error && <div className="form-error" role="alert">{error}</div>}
          {message && <div className="mortgage-success" role="status">{message}</div>}
          <div className="mortgage-actions">
            <button className="primary-button" disabled={loading || saving} type="submit">{saving ? "Saving…" : accountType === "super" ? "Save super accounts" : "Save accounts"} <ArrowRight size={15} /></button>
            {accounts.some((account) => !account.isMock) && <span>Saving replaces your current manually entered account list.</span>}
          </div>
        </form>
      </section>
    </div>
  );
}

function todayInputDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function EntriesPage({ kind, onChanged }: { kind: "income" | "spending"; onChanged: () => Promise<void> }) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringIncome[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(todayInputDate);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<IncomeRecurrence>("monthly");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRecurringId, setEditingRecurringId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pageTitle = kind === "income" ? "Income" : "Spending";

  async function loadEntries() {
    const list = await api.entries(kind);
    setEntries(list);
    if (kind === "income") {
      const [schedules, currentReport] = await Promise.all([api.recurringIncome(), api.report()]);
      setRecurringItems(schedules);
      setReport(currentReport);
    }
  }

  useEffect(() => {
    loadEntries()
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : `Unable to load ${kind} entries.`))
      .finally(() => setLoading(false));
  }, [kind]);

  function resetEntryForm() {
    setAmount("");
    setCategory("");
    setDescription("");
    setEntryDate(todayInputDate());
    setEditingId(null);
    setEditingRecurringId(null);
    setIsRecurring(false);
    setRecurrence("monthly");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    const entry = {
      kind,
      amountCents: Math.round(Number(amount) * 100),
      category,
      description,
      entryDate,
    };
    try {
      if (kind === "income" && isRecurring) {
        const schedule = {
          amountCents: entry.amountCents,
          category: entry.category,
          description: entry.description,
          nextDate: entry.entryDate,
          recurrence,
        };
        if (editingRecurringId === null) await api.createRecurringIncome(schedule);
        else await api.updateRecurringIncome(editingRecurringId, schedule);
      } else if (editingId === null) await api.createEntry(entry);
      else await api.updateEntry(editingId, entry);
      await loadEntries();
      await onChanged();
      setMessage(kind === "income" && isRecurring
        ? `Recurring income ${editingRecurringId === null ? "added" : "updated"}.`
        : `${pageTitle} entry ${editingId === null ? "added" : "updated"}.`);
      resetEntryForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to save ${kind} entry.`);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entry: FinanceEntry) {
    if (!window.confirm(`Delete this ${kind} entry for ${formatMoney(entry.amountCents)}?`)) return;
    setError("");
    try {
      await api.deleteEntry(entry.id);
      await loadEntries();
      await onChanged();
      if (editingId === entry.id) resetEntryForm();
      setMessage("Entry deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this entry.");
    }
  }

  async function removeRecurringIncome(item: RecurringIncome) {
    if (!window.confirm(`Delete recurring ${item.category} income of ${formatMoney(item.amountCents)}?`)) return;
    setError("");
    try {
      await api.deleteRecurringIncome(item.id);
      await loadEntries();
      await onChanged();
      if (editingRecurringId === item.id) resetEntryForm();
      setMessage("Recurring income deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete recurring income.");
    }
  }

  function editEntry(entry: FinanceEntry) {
    setEditingId(entry.id);
    setEditingRecurringId(null);
    setIsRecurring(false);
    setAmount((entry.amountCents / 100).toFixed(2));
    setCategory(entry.category);
    setDescription(entry.description);
    setEntryDate(entry.entryDate);
    setMessage("");
  }

  function editRecurringIncome(item: RecurringIncome) {
    setEditingId(null);
    setEditingRecurringId(item.id);
    setIsRecurring(true);
    setAmount((item.amountCents / 100).toFixed(2));
    setCategory(item.category);
    setDescription(item.description);
    setEntryDate(item.nextDate);
    setRecurrence(item.recurrence);
    setMessage("");
  }

  const monthTotal = entries
    .filter((entry) => entry.entryDate.slice(0, 7) === todayInputDate().slice(0, 7))
    .reduce((total, entry) => total + entry.amountCents, 0) +
    (kind === "income" ? (report?.incomeCents ?? 0) - entries
      .filter((entry) => entry.entryDate.slice(0, 7) === todayInputDate().slice(0, 7))
      .reduce((total, entry) => total + entry.amountCents, 0) : 0);

  return (
    <div className="secondary-page">
      <div className="welcome-row">
        <div><div className="eyebrow">YOUR HOUSEHOLD CASH FLOW</div><h1>{pageTitle}</h1><p className="welcome-subtitle">Enter dated transactions to build your monthly totals, dashboard charts and reports.</p></div>
        <span className="demo-badge no-sample-badge"><span /> YOUR DATA</span>
      </div>
      <div className="finance-summary-strip"><span>{pageTitle} this month</span><strong>{formatMoney(monthTotal)}</strong><span>{entries.length} saved {entries.length === 1 ? "entry" : "entries"}{kind === "income" && recurringItems.length > 0 ? " · includes expected recurring income" : ""}</span></div>
      <section className="panel finance-entry-panel">
        <div className="panel-heading"><div><h2>{editingId === null ? `Add ${kind} entry` : `Edit ${kind} entry`}</h2><p>Entries are for reports and charts only; they do not change account balances.</p></div></div>
        <form className="finance-entry-form" onSubmit={submit}>
          <label>Amount (AUD)<span className="money-input"><span>$</span><input inputMode="decimal" max="1000000000" min="0.01" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} /></span></label>
          <label>{kind === "income" ? "Source or category" : "Category"}<input maxLength={80} onChange={(event) => setCategory(event.target.value)} placeholder={kind === "income" ? "e.g. Salary" : "e.g. Groceries"} required value={category} /></label>
          <label>{isRecurring ? "Next payment date" : "Date"}<input onChange={(event) => setEntryDate(event.target.value)} required type="date" value={entryDate} /></label>
          <label className="entry-description-field">Notes (optional)<input maxLength={200} onChange={(event) => setDescription(event.target.value)} placeholder="Add a short note" value={description} /></label>
          {kind === "income" && <label className="recurring-income-toggle"><input checked={isRecurring} onChange={(event) => {
            setIsRecurring(event.target.checked);
            setEditingId(null);
            setEditingRecurringId(null);
          }} type="checkbox" /> This is recurring income</label>}
          {kind === "income" && isRecurring && <label>Frequency<select onChange={(event) => setRecurrence(event.target.value as IncomeRecurrence)} value={recurrence}>
            <option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
          </select></label>}
          {error && <div className="form-error" role="alert">{error}</div>}
          {message && <div className="mortgage-success" role="status">{message}</div>}
          <div className="finance-form-actions">
            <button className="primary-button" disabled={saving}>{saving ? "Saving…" : isRecurring ? editingRecurringId === null ? "Add recurring income" : "Update recurring income" : editingId === null ? `Add ${kind}` : "Update entry"} <ArrowRight size={15} /></button>
            {(editingId !== null || editingRecurringId !== null) && <button className="secondary-button" onClick={resetEntryForm} type="button">Cancel edit</button>}
          </div>
        </form>
      </section>
      <section className="panel finance-list-panel">
        <div className="panel-heading"><div><h2>Entries</h2><p>Most recent first.</p></div></div>
        {loading ? <p className="mortgage-status">Loading entries…</p> : entries.length === 0 ? (
          <p className="dashboard-section-empty">No {kind} entries yet. Add one above to populate charts and reports.</p>
        ) : (
          <div className="finance-entry-list">
            {entries.map((entry) => (
              <article className="finance-entry-row" key={entry.id}>
                <div className="finance-entry-date">{formatDate(entry.entryDate, { year: "numeric" })}</div>
                <div className="finance-entry-details"><strong>{entry.category}</strong>{entry.description && <span>{entry.description}</span>}</div>
                <strong className="finance-entry-amount">{formatMoney(entry.amountCents)}</strong>
                <button className="account-delete-button" onClick={() => editEntry(entry)} type="button">Edit</button>
                <button className="account-delete-button" onClick={() => void removeEntry(entry)} type="button">Delete</button>
              </article>
            ))}
          </div>
        )}
      </section>
      {kind === "income" && (
        <section className="panel finance-list-panel">
          <div className="panel-heading"><div><h2>Recurring income</h2><p>Expected income is included in this month’s dashboard totals and reports.</p></div></div>
          {loading ? <p className="mortgage-status">Loading recurring income…</p> : recurringItems.length === 0 ? (
            <p className="dashboard-section-empty">No recurring income schedules yet. Choose “This is recurring income” when adding regular pay or another expected payment.</p>
          ) : (
            <div className="finance-entry-list">{recurringItems.map((item) => (
              <article className="finance-entry-row" key={item.id}>
                <div className="finance-entry-date">{formatDate(item.nextDate, { year: "numeric" })}</div>
                <div className="finance-entry-details"><strong>{item.category}</strong><span>Expected {({ weekly: "weekly", fortnightly: "fortnightly", monthly: "monthly", quarterly: "quarterly", yearly: "yearly" })[item.recurrence]} · Next {formatDate(item.nextDate, { year: "numeric" })}{item.description ? ` · ${item.description}` : ""}</span></div>
                <strong className="finance-entry-amount">{formatMoney(item.amountCents)}</strong>
                <button className="account-delete-button" onClick={() => editRecurringIncome(item)} type="button">Edit</button>
                <button className="account-delete-button" onClick={() => void removeRecurringIncome(item)} type="button">Delete</button>
              </article>
            ))}</div>
          )}
        </section>
      )}
    </div>
  );
}

interface PlannerDraft {
  kind: "bill" | "insurance";
  name: string;
  provider: string;
  amount: string;
  dueDate: string;
  recurrence: Recurrence;
  notes: string;
}

function emptyPlannerDraft(kind: PlannerKind): PlannerDraft {
  return { kind, name: "", provider: "", amount: "", dueDate: todayInputDate(), recurrence: "none", notes: "" };
}

function PlannerPage({ kind, onChanged }: { kind: PlannerKind; onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [draft, setDraft] = useState<PlannerDraft>(() => emptyPlannerDraft(kind));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const title = kind === "bill" ? "Bills" : "Insurance";

  async function loadItems() {
    setItems(await api.plannerItems(kind));
  }

  useEffect(() => {
    loadItems()
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : `Unable to load ${title.toLowerCase()}.`))
      .finally(() => setLoading(false));
  }, [kind]);

  function resetForm() {
    setDraft(emptyPlannerDraft(kind));
    setEditingId(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    const payload: PlannerItemInput = {
      ...draft,
      amountCents: Math.round(Number(draft.amount) * 100),
    };
    try {
      if (editingId === null) await api.createPlannerItem(payload);
      else await api.updatePlannerItem(editingId, payload);
      await loadItems();
      await onChanged();
      setMessage(`${title.slice(0, -1)} ${editingId === null ? "added" : "updated"}.`);
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to save ${title.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: PlannerItem) {
    if (!window.confirm(`Delete “${item.name}”?`)) return;
    setError("");
    try {
      await api.deletePlannerItem(item.id);
      await loadItems();
      await onChanged();
      if (editingId === item.id) resetForm();
      setMessage(`${title.slice(0, -1)} deleted.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to delete ${title.toLowerCase()} item.`);
    }
  }

  function editItem(item: PlannerItem) {
    setEditingId(item.id);
    setDraft({
      kind,
      name: item.name,
      provider: item.provider,
      amount: (item.amountCents / 100).toFixed(2),
      dueDate: item.nextDueDate,
      recurrence: item.recurrence,
      notes: item.notes,
    });
  }

  return (
    <div className="secondary-page">
      <div className="welcome-row"><div><div className="eyebrow">UPCOMING HOUSEHOLD COSTS</div><h1>{title}</h1><p className="welcome-subtitle">Track one-off or recurring {title.toLowerCase()} and their next due dates.</p></div></div>
      <section className="panel finance-entry-panel">
        <div className="panel-heading"><div><h2>{editingId === null ? `Add ${kind === "bill" ? "bill" : "insurance policy"}` : `Edit ${kind === "bill" ? "bill" : "insurance policy"}`}</h2><p>Recurring items calculate the next due date from the date you enter.</p></div></div>
        <form className="finance-entry-form" onSubmit={submit}>
          <label>Name<input maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={kind === "bill" ? "e.g. Electricity" : "e.g. Home insurance"} required value={draft.name} /></label>
          <label>{kind === "bill" ? "Provider (optional)" : "Insurer"}<input maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, provider: event.target.value }))} value={draft.provider} /></label>
          <label>Amount (AUD)<span className="money-input"><span>$</span><input inputMode="decimal" max="1000000000" min="0.01" onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} required step="0.01" type="number" value={draft.amount} /></span></label>
          <label>Next due date<input onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} required type="date" value={draft.dueDate} /></label>
          <label>Recurrence<select onChange={(event) => setDraft((current) => ({ ...current, recurrence: event.target.value as Recurrence }))} value={draft.recurrence}>
            <option value="none">One-off</option><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
          </select></label>
          <label className="entry-description-field">Notes (optional)<input maxLength={300} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} value={draft.notes} /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          {message && <div className="mortgage-success" role="status">{message}</div>}
          <div className="finance-form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving…" : editingId === null ? `Add ${kind === "bill" ? "bill" : "policy"}` : "Update item"} <ArrowRight size={15} /></button>{editingId !== null && <button className="secondary-button" onClick={resetForm} type="button">Cancel edit</button>}</div>
        </form>
      </section>
      <section className="panel finance-list-panel">
        <div className="panel-heading"><div><h2>{kind === "bill" ? "Upcoming bills" : "Policies and renewals"}</h2><p>Recurring due dates roll forward automatically.</p></div></div>
        {loading ? <p className="mortgage-status">Loading {title.toLowerCase()}…</p> : items.length === 0 ? <p className="dashboard-section-empty">No {title.toLowerCase()} added yet.</p> : (
          <div className="finance-entry-list">{items.map((item) => (
            <article className="finance-entry-row" key={item.id}>
              <div className="finance-entry-date">{formatDate(item.nextDueDate, { year: "numeric" })}</div>
              <div className="finance-entry-details"><strong>{item.name}</strong><span>{[item.provider, item.recurrence === "none" ? "One-off" : ({ weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly", none: "One-off" }[item.recurrence])].filter(Boolean).join(" · ")}{item.notes ? ` · ${item.notes}` : ""}</span></div>
              <strong className="finance-entry-amount">{formatMoney(item.amountCents)}</strong>
              <button className="account-delete-button" onClick={() => editItem(item)} type="button">Edit</button>
              <button className="account-delete-button" onClick={() => void removeItem(item)} type="button">Delete</button>
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}

interface BudgetDraft {
  category: string;
  limit: string;
}

function BudgetsPage({ onChanged }: { onChanged: () => Promise<void> }) {
  const [budgets, setBudgets] = useState<BudgetPlan[]>([]);
  const [drafts, setDrafts] = useState<BudgetDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.budgets()
      .then((loaded) => {
        setBudgets(loaded);
        setDrafts(loaded.map((budget) => ({
          category: budget.category,
          limit: (budget.limitCents / 100).toFixed(2),
        })));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load budgets."))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const saved = await api.saveBudgets(drafts.map((budget) => ({
        category: budget.category,
        limitCents: Math.round(Number(budget.limit) * 100),
      })));
      setBudgets(saved);
      setDrafts(saved.map((budget) => ({ category: budget.category, limit: (budget.limitCents / 100).toFixed(2) })));
      await onChanged();
      setMessage("Monthly budgets saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save budgets.");
    } finally {
      setSaving(false);
    }
  }

  const spentThisMonth = budgets.reduce((total, budget) => total + budget.spentCents, 0);
  const limitThisMonth = budgets.reduce((total, budget) => total + budget.limitCents, 0);

  return (
    <div className="secondary-page">
      <div className="welcome-row"><div><div className="eyebrow">PLAN YOUR MONTHLY SPENDING</div><h1>Budgets</h1><p className="welcome-subtitle">Set spending limits by category; spending entries update progress automatically.</p></div></div>
      <div className="finance-summary-strip"><span>Tracked this month</span><strong>{formatMoney(spentThisMonth)} / {formatMoney(limitThisMonth)}</strong><span>{budgets.length} {budgets.length === 1 ? "category" : "categories"}</span></div>
      <section className="panel finance-list-panel">
        <div className="panel-heading"><div><h2>Monthly budget progress</h2><p>Based on this month’s spending entries in matching categories.</p></div></div>
        {loading ? <p className="mortgage-status">Loading budgets…</p> : budgets.length === 0 ? <p className="dashboard-section-empty">No budgets yet. Add categories and monthly limits below.</p> : (
          <div className="budget-list">{budgets.map((budget) => {
            const percentage = Math.round((budget.spentCents / budget.limitCents) * 100);
            return <div className="budget-row" key={budget.id}>
              <div className="budget-topline"><strong>{budget.category}</strong><span>{formatMoney(budget.spentCents)} of {formatMoney(budget.limitCents)} · {percentage}%</span></div>
              <div className="budget-track"><span className={percentage >= 95 ? "near-limit" : ""} style={{ width: `${Math.min(100, percentage)}%` }} /></div>
            </div>;
          })}</div>
        )}
      </section>
      <section className="panel finance-entry-panel">
        <div className="accounts-form-heading"><div><h2>Budget categories</h2><p>Add or remove monthly limits as needed.</p></div><button className="secondary-button add-split-button" onClick={() => setDrafts((current) => [...current, { category: "", limit: "" }])} type="button">+ Add category</button></div>
        {loading ? <p className="mortgage-status">Loading…</p> : (
          <form className="budget-edit-form" onSubmit={submit}>
            {drafts.map((budget, index) => <div className="budget-edit-row" key={index}>
              <label>Category<input maxLength={80} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value } : item))} required value={budget.category} /></label>
              <label>Monthly limit (AUD)<span className="money-input"><span>$</span><input inputMode="decimal" min="0.01" onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, limit: event.target.value } : item))} required step="0.01" type="number" value={budget.limit} /></span></label>
              <button className="account-delete-button" onClick={() => setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>
            </div>)}
            {error && <div className="form-error" role="alert">{error}</div>}
            {message && <div className="mortgage-success" role="status">{message}</div>}
            <div className="finance-form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save budgets"} <ArrowRight size={15} /></button></div>
          </form>
        )}
      </section>
    </div>
  );
}

function ReportsPage() {
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.report()
      .then(setReport)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load reports."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="secondary-page">
      <div className="welcome-row"><div><div className="eyebrow">YOUR FINANCIAL ACTIVITY</div><h1>Reports</h1><p className="welcome-subtitle">Monthly income and spending trends from your entries over the last 12 months.</p></div></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading ? <section className="panel finance-list-panel"><p className="mortgage-status">Loading reports…</p></section> : report && (
        <>
          <div className="finance-summary-strip"><span>This month income<strong>{formatMoney(report.incomeCents)}</strong></span><span>This month spending<strong>{formatMoney(report.spendingCents)}</strong></span><span>Net<strong>{formatMoney(report.incomeCents - report.spendingCents)}</strong></span></div>
          {report.monthly.length === 0 ? (
            <section className="panel report-empty-state"><h2>No report data yet</h2><p>Add income and spending entries to generate monthly charts and category summaries.</p></section>
          ) : (
            <>
              <section className="panel report-chart-panel">
                <div className="panel-heading"><div><h2>Monthly cash flow</h2><p>Income and spending for months with recorded entries.</p></div></div>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.monthly} margin={{ top: 12, right: 5, bottom: 0, left: -12 }}>
                      <defs><linearGradient id="reportIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5d87e8" stopOpacity={0.2} /><stop offset="100%" stopColor="#5d87e8" stopOpacity={0} /></linearGradient><linearGradient id="reportSpending" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd" stopOpacity={0.25} /><stop offset="100%" stopColor="#c4b5fd" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke="#edf0f4" vertical={false} />
                      <XAxis dataKey="month" tickFormatter={formatMonth} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(value: number) => `$${(value / 100000).toFixed(1)}k`} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="incomeCents" name="Income" stroke="#5d87e8" strokeWidth={2.5} fill="url(#reportIncome)" />
                      <Area type="monotone" dataKey="spendingCents" name="Spending" stroke="#a78bfa" strokeWidth={2.5} fill="url(#reportSpending)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="panel finance-list-panel">
                <div className="panel-heading"><div><h2>Spending by category</h2><p>This month.</p></div></div>
                {report.categories.length === 0 ? <p className="dashboard-section-empty">No spending entries recorded this month.</p> : report.categories.map((category) => (
                  <div className="budget-topline report-category-row" key={category.category}><strong>{category.category}</strong><span>{formatMoney(category.spendingCents)}</span></div>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface MortgageSplitDraft {
  name: string;
  balance: string;
  interestRate: string;
  repayment: string;
  rateType: "variable" | "fixed";
  repaymentFrequency: "weekly" | "fortnightly" | "monthly";
}

function newMortgageSplit(index: number): MortgageSplitDraft {
  return {
    name: `Loan split ${index + 1}`,
    balance: "",
    interestRate: "",
    repayment: "",
    rateType: "variable",
    repaymentFrequency: "monthly",
  };
}

function MortgagePage({ onSaved }: { onSaved: (mortgages: MortgageSplit[]) => void }) {
  const [loans, setLoans] = useState<MortgageSplitDraft[]>([]);
  const [savedMortgages, setSavedMortgages] = useState<MortgageSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.mortgage()
      .then((mortgages) => {
        setSavedMortgages(mortgages);
        setLoans(mortgages.length
          ? mortgages.map((mortgage) => ({
            name: mortgage.name,
            balance: (mortgage.balanceCents / 100).toFixed(2),
            interestRate: mortgage.interestRateBps === null ? "" : (mortgage.interestRateBps / 100).toFixed(2),
            repayment: mortgage.repaymentCents === null ? "" : (mortgage.repaymentCents / 100).toFixed(2),
            rateType: mortgage.rateType,
            repaymentFrequency: mortgage.repaymentFrequency,
          }))
          : [newMortgageSplit(0)]);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to load your mortgage details.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const mortgages = await api.saveMortgage(loans.map((loan) => ({
        name: loan.name,
        balanceCents: Math.round(Number(loan.balance) * 100),
        interestRateBps: loan.interestRate === "" ? null : Math.round(Number(loan.interestRate) * 100),
        repaymentCents: loan.repayment === "" ? null : Math.round(Number(loan.repayment) * 100),
        rateType: loan.rateType,
        repaymentFrequency: loan.repaymentFrequency,
      })));
      setSavedMortgages(mortgages);
      setMessage("Your ME home-loan splits have been saved on this device.");
      onSaved(mortgages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your mortgage details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="secondary-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">YOUR HOME LOAN</div>
          <h1>Mortgage</h1>
          <p className="welcome-subtitle">Keep your ME home-loan balance and repayment details up to date.</p>
        </div>
      </div>
      <section className="panel mortgage-panel">
        <div className="mortgage-notice">
          <LockKeyhole size={17} />
          <p><strong>Manual entry only</strong><span>Add a split for each separate amount in your ME loan. This does not connect to ME Bank; never enter your banking password here.</span></p>
        </div>
        {loading ? <p className="mortgage-status">Loading saved loan details…</p> : (
          <form className="mortgage-form" onSubmit={submit}>
            {loans.map((loan, index) => (
              <fieldset className="mortgage-split" key={index}>
                <legend>Loan split {index + 1}</legend>
                <button className="remove-split-button" disabled={loans.length === 1} onClick={() => setLoans((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>
                <label>
                  Split name
                  <input maxLength={80} onChange={(event) => setLoans((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} required value={loan.name} />
                </label>
                <label>
                  Loan balance (AUD)
                  <span className="money-input"><span>$</span><input inputMode="decimal" max="100000000" min="0.01" onChange={(event) => setLoans((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, balance: event.target.value } : item))} required step="0.01" type="number" value={loan.balance} /></span>
                </label>
                <label>
                  Interest rate (optional)
                  <span className="suffix-input"><input inputMode="decimal" max="100" min="0" onChange={(event) => setLoans((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, interestRate: event.target.value } : item))} placeholder="e.g. 6.15" step="0.01" type="number" value={loan.interestRate} /><span>% p.a.</span></span>
                </label>
                <label className="fixed-rate-option">
                  <input checked={loan.rateType === "fixed"} onChange={(event) => setLoans((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, rateType: event.target.checked ? "fixed" : "variable" } : item))} type="checkbox" />
                  Fixed rate <span>{loan.rateType === "fixed" ? "Fixed" : "Variable"}</span>
                </label>
                <label>
                  Repayment amount (optional)
                  <span className="money-input"><span>$</span><input inputMode="decimal" min="0" onChange={(event) => setLoans((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, repayment: event.target.value } : item))} placeholder="e.g. 2,500" step="0.01" type="number" value={loan.repayment} /></span>
                </label>
                <label>
                  Repayment frequency
                  <select onChange={(event) => setLoans((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, repaymentFrequency: event.target.value as MortgageSplitDraft["repaymentFrequency"] } : item))} value={loan.repaymentFrequency}>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
              </fieldset>
            ))}
            <button className="secondary-button add-split-button" onClick={() => setLoans((current) => [...current, newMortgageSplit(current.length)])} type="button">+ Add another loan split</button>
            <div className="mortgage-total"><span>Total loan balance</span><strong>{formatMoney(loans.reduce((total, loan) => total + (Number(loan.balance) || 0) * 100, 0))}</strong></div>
            {error && <div className="form-error" role="alert">{error}</div>}
            {message && <div className="mortgage-success" role="status">{message}</div>}
            <div className="mortgage-actions">
              <button className="primary-button" disabled={saving} type="submit">{saving ? "Saving…" : savedMortgages.length ? "Update loan splits" : "Save loan splits"} <ArrowRight size={15} /></button>
              {savedMortgages.length > 0 && <span>Last updated {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(savedMortgages[0].updatedAt))}</span>}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function ComingSoonPage({ page, onDashboard }: { page: string; onDashboard: () => void }) {
  return (
    <div className="coming-page">
      <div className="coming-icon">{page === "Insurance" ? <ShieldCheck size={25} /> : page === "Mortgage" ? <House size={25} /> : <ChartNoAxesCombined size={25} />}</div>
      <div className="eyebrow">ON THE ROADMAP</div>
      <h1>{page}</h1>
      <p>This part of your finance dashboard is planned for a later phase. Your dashboard and settings are ready to use now.</p>
      <button className="primary-button" onClick={onDashboard}>Back to dashboard <ArrowRight size={15} /></button>
    </div>
  );
}

function DashboardUnavailable({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="coming-page">
      <div className="coming-icon"><CircleHelp size={25} /></div>
      <div className="eyebrow">LOCAL DASHBOARD</div>
      <h1>Your dashboard couldn’t load</h1>
      <p>{error || "Your saved information is still on this device. Try connecting to the local app again."}</p>
      <button className="primary-button" onClick={onRetry}>Try again <ArrowRight size={15} /></button>
    </div>
  );
}
