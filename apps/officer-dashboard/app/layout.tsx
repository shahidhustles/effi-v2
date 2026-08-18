import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = { title: "Effi | Officer dashboard", description: "Evidence-backed civic case management." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><AppProviders>{children}</AppProviders></body></html>;
}
