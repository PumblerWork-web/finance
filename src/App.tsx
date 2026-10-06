import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
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
import type { AuthStatus, DashboardData } from "./types";

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
                  {label === "Bills" && <span className="nav-count">3</span>}
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
          <Dashboard data={data} displayName={auth.displayName ?? "there"} />
        ) : (
          <DashboardUnavailable error={error} onRetry={retryDashboard} />
        ) : activePage === "Settings" ? (
          <SettingsPage displayName={auth.displayName ?? ""} onLogout={handleLogout} />
        ) : (
          <ComingSoonPage page={activePage} onDashboard={() => setActivePage("Dashboard")} />
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

function Dashboard({ data, displayName }: { data: DashboardData; displayName: string }) {
  const firstName = displayName.split(/\s+/)[0] || "there";
  const currentHour = new Date().getHours();
  const salutation = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const latestMonth = data.spendingHistory.at(-1);

  return (
    <div className="dashboard-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{dateLabel}</div>
          <h1>{salutation}, {firstName}<span className="wave">.</span></h1>
          <p className="welcome-subtitle">Here’s your household financial snapshot.</p>
        </div>
        <span className="demo-badge"><span /> DEMO DATA</span>
      </div>

      <section className="net-worth-card">
        <div className="net-worth-content">
          <div className="card-eyebrow light-eyebrow"><span className="status-dot" /> NET FINANCIAL POSITION</div>
          <div className="net-worth-amount">{formatMoney(data.netPositionCents)}</div>
          <p className="net-worth-description">Cash and super, less your home loan</p>
          <div className="net-worth-change"><span className="change-pill"><Check size={13} /> DEMO</span><span>illustrative household snapshot</span></div>
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
        <MetricCard icon={House} title="Mortgage" amount={data.mortgageCents} note={`Effective ${formatMoney(data.mortgageCents - data.offsetCents)}`} tone="peach" />
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
          </div>
          <div className="chart-summary">
            <div><span>Income this month</span><strong>{formatMoney(latestMonth?.incomeCents ?? data.monthlyIncomeCents)}</strong></div>
            <div><span>Spent this month</span><strong>{formatMoney(latestMonth?.spendingCents ?? data.monthlySpendingCents)}</strong></div>
            <div><span>Monthly surplus</span><strong className="positive">{formatMoney(data.monthlySurplusCents)}</strong></div>
          </div>
        </div>

        <div className="panel upcoming-panel">
          <div className="panel-heading">
            <div><h2>Coming up</h2><p>Bills &amp; renewals to keep an eye on</p></div>
            <button className="circle-action" aria-label="View all upcoming items"><ArrowRight size={16} /></button>
          </div>
          <div className="upcoming-list">
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
          <div className="snapshot-note"><span className="note-sparkle">✦</span><span>You kept <strong>{Math.round((data.monthlySurplusCents / data.monthlyIncomeCents) * 100)}%</strong> of household income this month.</span></div>
        </div>
      </section>

      <div className="data-disclaimer"><CircleHelp size={15} /><span>These are sample figures to help you explore the dashboard. No real financial data is connected.</span><span className="updated-at">Updated {new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(new Date(data.updatedAt))}</span></div>
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

function SettingsPage({ displayName, onLogout }: { displayName: string; onLogout: () => Promise<void> }) {
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
