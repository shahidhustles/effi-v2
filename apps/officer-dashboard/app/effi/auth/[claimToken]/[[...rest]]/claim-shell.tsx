import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@effi/ui-web";

export function ClaimShell({ children }: { children: ReactNode }) {
  return (
    <main className="claim-page">
      <div className="claim-frame">
        <section className="claim-context" aria-labelledby="claim-context-title">
          <Link className="claim-brand-link" href="/" aria-label="Effi home">
            <Brand />
          </Link>

          <div className="claim-context-copy">
            <p className="claim-eyebrow">Secure report registration</p>
            <h1 id="claim-context-title">One last step.</h1>
            <p>
              Sign in or create an account to attach this report to you. Your issue, location, and evidence are already saved.
            </p>
          </div>

          <ol className="claim-steps" aria-label="Registration progress">
            <li className="is-complete">
              <span aria-hidden="true">1</span>
              <div><strong>Report prepared</strong><small>Completed in your chat</small></div>
            </li>
            <li className="is-current">
              <span aria-hidden="true">2</span>
              <div><strong>Confirm your identity</strong><small>Sign in or create an account</small></div>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <div><strong>Receive your report ID</strong><small>Sent back to the same chat</small></div>
            </li>
          </ol>

          <p className="claim-privacy-note">Effi uses your identity only to register and track your civic report.</p>
        </section>

        <section className="claim-action" aria-label="Report registration">
          {children}
        </section>
      </div>
    </main>
  );
}
