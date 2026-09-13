"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

type OfficerNav = "cases" | "assigned";

type OfficerShellProps = {
  activeNav: OfficerNav;
  assignedCount?: number | undefined;
  caseCount?: number | undefined;
  children: ReactNode;
  search?: ReactNode;
};

function NavIcon({ kind }: { kind: "cases" | "assigned" | "reports" | "analytics" | "settings" }) {
  const paths = {
    cases: <><path d="M3 7.5h18v11.25A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V7.5Z" /><path d="M3 9h18M8.25 7.5l1.5-3h4.5l1.5 3" /></>,
    assigned: <><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20c.55-4 2.72-6 6.5-6s5.95 2 6.5 6" /></>,
    reports: <><path d="M6 3.75h8.25L18 7.5v12.75H6V3.75Z" /><path d="M14.25 3.75V7.5H18M9 12h6M9 15.5h6" /></>,
    analytics: <><path d="M4 20h16M6.5 17V11M11 17V5M15.5 17V8M20 17v-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.52.7 1 .98.35.2.74.3 1.1.3h.1v4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>,
  } satisfies Record<string, ReactNode>;

  return <svg className="officer-nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[kind]}</svg>;
}

function Sidebar({ activeNav, assignedCount, caseCount, onNavigate }: Omit<OfficerShellProps, "children" | "search"> & { onNavigate: () => void }) {
  return (
    <aside className="officer-sidebar">
      <div className="officer-brand-block">
        <Link className="officer-brand" href="/" onClick={onNavigate}>Effi</Link>
        <p>People · Progress · Safer Communities</p>
      </div>

      <nav className="officer-nav" aria-label="Officer workspace">
        <Link className={activeNav === "cases" ? "is-active" : ""} href="/" onClick={onNavigate}>
          <NavIcon kind="cases" />
          <span>Cases</span>
          {caseCount !== undefined ? <strong>{caseCount}</strong> : null}
        </Link>
        <Link className={activeNav === "assigned" ? "is-active" : ""} href="/?view=assigned" onClick={onNavigate}>
          <NavIcon kind="assigned" />
          <span>My assigned</span>
          {assignedCount !== undefined ? <strong>{assignedCount}</strong> : null}
        </Link>
        <span className="is-unavailable" aria-disabled="true" title="Reports are not available yet">
          <NavIcon kind="reports" /><span>Reports</span>
        </span>
        <span className="is-unavailable" aria-disabled="true" title="Analytics are not available yet">
          <NavIcon kind="analytics" /><span>Analytics</span>
        </span>
        <span className="is-unavailable" aria-disabled="true" title="Settings are not available yet">
          <NavIcon kind="settings" /><span>Settings</span>
        </span>
      </nav>

      <div className="officer-sidebar-foot">
        <Image
          className="officer-sidebar-art"
          src="/brand/civic-dome-v1.png"
          alt=""
          width={1009}
          height={1558}
          sizes="248px"
        />
        <p>Safer roads<br />Stronger communities</p>
      </div>
    </aside>
  );
}

export function OfficerShell({ activeNav, assignedCount, caseCount, children, search }: OfficerShellProps) {
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const officerName = user?.fullName ?? user?.firstName ?? "Officer";

  return (
    <div className={`officer-workspace${menuOpen ? " has-open-menu" : ""}`}>
      <button className="officer-menu-scrim" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      <Sidebar activeNav={activeNav} assignedCount={assignedCount} caseCount={caseCount} onNavigate={() => setMenuOpen(false)} />
      <div className="officer-main">
        <header className="officer-topbar">
          <button className="officer-menu-button" type="button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>
            <span /><span /><span />
          </button>
          <div className="officer-search-slot">{search}</div>
          <div className="officer-account">
            <div className="officer-account-copy">
              <strong>{officerName}</strong>
              <span>Field officer</span>
            </div>
            <UserButton />
          </div>
        </header>
        <main className="officer-content">{children}</main>
      </div>
    </div>
  );
}
