import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export const PageFrame = ({ children }: { children: ReactNode }) => <main className="effi-page-frame">{children}</main>;

export function Brand() {
  return (
    <span className="effi-brand">
      <svg className="effi-brand-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M12 1.8c.7 5.1 4.4 8.8 9.5 9.5-5.1.7-8.8 4.4-9.5 9.5-.7-5.1-4.4-8.8-9.5-9.5 5.1-.7 8.8-4.4 9.5-9.5Z" />
      </svg>
      <span className="effi-brand-word">Effi</span>
    </span>
  );
}

export type SurfaceTone = "white" | "fog" | "lavender" | "mint";

export function Surface({ tone = "white", className, children, ...rest }: { tone?: SurfaceTone; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const classes = ["effi-surface", `effi-surface-${tone}`, className].filter(Boolean).join(" ");
  return <div className={classes} {...rest}>{children}</div>;
}

export type BadgeTone = "violet" | "ink" | "lavender" | "orchid" | "fog" | "mint" | "outline";

export function Badge({ tone = "fog", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  const classes = ["effi-badge", `effi-badge-${tone}`, className].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}

export type ButtonVariant = "primary" | "dark" | "ghost";

export function Button({ variant = "primary", className, children, type = "button", ...rest }: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = ["effi-button", `effi-button-${variant}`, className].filter(Boolean).join(" ");
  return <button className={classes} type={type} {...rest}>{children}</button>;
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={["effi-skeleton", className].filter(Boolean).join(" ")} />;
}
