import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "./providers";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage-grotesque",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = { title: "Effi | Officer dashboard", description: "Evidence-backed civic case management." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bricolage.variable} ${inter.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
