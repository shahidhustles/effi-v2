import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "./providers";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = { title: "Effi | Officer dashboard", description: "Evidence-backed civic case management." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${newsreader.variable} ${sourceSans.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
