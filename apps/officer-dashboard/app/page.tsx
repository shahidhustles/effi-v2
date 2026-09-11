import { SignIn, Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Brand, PageFrame } from "@effi/ui-web";
import { CaseInbox } from "../components/case-inbox";
import { clerkAppearance } from "./clerk-appearance";

export default function DashboardHome() {
  return (
    <>
      <header className="effi-topbar">
        <div className="effi-topbar-inner">
          <Link className="effi-brand-link" href="/" aria-label="Effi home"><Brand /></Link>
          <div className="effi-topbar-actions">
            <span className="effi-topbar-note">Officer console</span>
            <Show when="signed-in"><UserButton /></Show>
          </div>
        </div>
      </header>
      <PageFrame>
        <Show when="signed-out">
          <section className="effi-auth" aria-labelledby="officer-sign-in-title">
            <div className="effi-auth-panel">
              <p className="effi-eyebrow">Officer access</p>
              <h1 id="officer-sign-in-title">Officer case inbox</h1>
              <p className="effi-auth-lede">Sign in with the officer account to load live cases. Citizen accounts cannot read case data.</p>
              <SignIn routing="hash" appearance={clerkAppearance} />
            </div>
          </section>
        </Show>
        <Show when="signed-in">
          <CaseInbox />
        </Show>
      </PageFrame>
    </>
  );
}
