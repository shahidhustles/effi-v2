import type { ReactNode } from "react";

export const PageFrame = ({ children }: { children: ReactNode }) => <main className="effi-page-frame">{children}</main>;
export const StatusPill = ({ children }: { children: ReactNode }) => <span className="effi-status-pill">{children}</span>;
