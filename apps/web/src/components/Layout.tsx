import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
const links = [
  ["/agent", "Agent"],
  ["/receipts", "Receipts"],
  ["/developer", "Developer"],
  ["/about", "About"],
] as const;
export function Logo() {
  return (
    <NavLink className="logo" to="/" aria-label="AgriPay home">
      <span className="logo-mark" aria-hidden="true">
        A
      </span>
      <span>
        AgriPay <b>Agent</b>
      </span>
    </NavLink>
  );
}
export function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <header className="site-header">
        <Logo />
        <nav aria-label="Primary navigation" className={open ? "open" : ""}>
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => {
                setOpen(false);
              }}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          className="menu-button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
          }}
        >
          Menu
        </button>
        <NavLink className="button button-small" to="/agent">
          Ask the agent
        </NavLink>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <Logo />
        <p>Autonomous intelligence, paid one insight at a time.</p>
        <div>
          <a href="https://github.com/gethsun1/agripay-agent" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          <span>Hedera testnet only</span>
        </div>
      </footer>
    </div>
  );
}
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`status status-${tone}`}>
      <span aria-hidden="true" /> {children}
    </span>
  );
}
export function SectionHead({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="section-head">
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}
