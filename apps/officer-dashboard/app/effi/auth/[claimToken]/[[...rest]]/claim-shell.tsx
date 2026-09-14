import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@effi/ui-web";

export function ClaimShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-canvas p-0 sm:p-4 lg:p-7">
      <div className="grid min-h-[100dvh] w-full max-w-[1120px] overflow-hidden bg-surface sm:min-h-[calc(100dvh-32px)] sm:rounded-xl sm:border sm:border-line sm:shadow-panel lg:grid-cols-[0.92fr_1.08fr]">
        <section className="flex flex-col border-b border-line bg-lavender/45 p-6 sm:p-7 lg:border-b-0 lg:border-r lg:p-12" aria-labelledby="claim-context-title">
          <Link className="w-fit" href="/" aria-label="Effi home">
            <Brand />
          </Link>

          <div className="mt-12 sm:mt-16 lg:mt-24">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">Secure report registration</p>
            <h1 className="font-display text-[clamp(2.625rem,5vw,4rem)] font-medium leading-none tracking-[-0.045em] text-ink" id="claim-context-title">One last step.</h1>
            <p className="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-graphite">
              Sign in or create an account to attach this report to you. Your issue, location, and evidence are already saved.
            </p>
          </div>

          <ol className="mt-12 hidden grid-cols-1 gap-5 text-sm text-muted lg:grid" aria-label="Registration progress">
            <li className="flex items-start gap-3 text-ink">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-action text-xs font-bold text-white" aria-hidden="true">1</span>
              <div><strong>Report prepared</strong><small>Completed in your chat</small></div>
            </li>
            <li className="flex items-start gap-3 text-ink">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-action bg-surface text-xs font-bold text-action" aria-hidden="true">2</span>
              <div><strong>Confirm your identity</strong><small>Sign in or create an account</small></div>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface text-xs font-bold" aria-hidden="true">3</span>
              <div><strong>Receive your report ID</strong><small>Sent back to the same chat</small></div>
            </li>
          </ol>

          <p className="mt-auto hidden pt-12 text-xs leading-relaxed text-muted lg:block">Effi uses your identity only to register and track your civic report.</p>
        </section>

        <section className="grid min-h-[460px] place-items-center bg-surface px-6 py-9 sm:px-7 lg:min-h-0 lg:p-12" aria-label="Report registration">
          {children}
        </section>
      </div>
    </main>
  );
}
