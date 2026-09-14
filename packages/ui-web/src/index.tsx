import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export const PageFrame = ({ children }: { children: ReactNode }) => <main className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">{children}</main>;

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-[28px] font-semibold tracking-[-0.045em] text-ink">
      <svg className="size-[18px] text-action" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M12 1.8c.7 5.1 4.4 8.8 9.5 9.5-5.1.7-8.8 4.4-9.5 9.5-.7-5.1-4.4-8.8-9.5-9.5 5.1-.7 8.8-4.4 9.5-9.5Z" />
      </svg>
      <span>Effi</span>
    </span>
  );
}

export type SurfaceTone = "white" | "fog" | "lavender" | "mint";

export function Surface({ tone = "white", className, children, ...rest }: { tone?: SurfaceTone; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const tones: Record<SurfaceTone, string> = { white: "bg-surface", fog: "bg-fog", lavender: "bg-lavender", mint: "bg-mint" };
  const classes = ["rounded-[10px] border border-line", tones[tone], className].filter(Boolean).join(" ");
  return <div className={classes} {...rest}>{children}</div>;
}

export type BadgeTone = "violet" | "ink" | "lavender" | "orchid" | "fog" | "mint" | "outline";

export function Badge({ tone = "fog", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  const tones: Record<BadgeTone, string> = {
    violet: "bg-[#e1f3fe] text-[#1f628e]",
    ink: "bg-[#fdebec] text-[#8a2d2b]",
    lavender: "bg-[#fbf3db] text-[#7e5900]",
    orchid: "bg-[#f4e9ed] text-[#865063]",
    fog: "bg-[#efefec] text-[#55544f]",
    mint: "bg-mint text-[#346538]",
    outline: "border-line bg-surface text-[#66645f]",
  };
  const classes = ["inline-flex w-fit items-center whitespace-nowrap rounded-full border border-transparent px-2 py-1 text-[10px] font-bold uppercase tracking-[0.035em]", tones[tone], className].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}

export type ButtonVariant = "primary" | "dark" | "ghost";

export function Button({ variant = "primary", className, children, type = "button", ...rest }: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<ButtonVariant, string> = {
    primary: "border-action bg-action text-white hover:bg-action-hover",
    dark: "border-ink bg-ink text-white hover:bg-graphite",
    ghost: "border-ink bg-transparent text-ink hover:bg-fog",
  };
  const classes = ["inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold transition-colors duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none", variants[variant], className].filter(Boolean).join(" ");
  return <button className={classes} type={type} {...rest}>{children}</button>;
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={["block animate-pulse rounded-md bg-[#e9e8e3] motion-reduce:animate-none", className].filter(Boolean).join(" ")} />;
}
