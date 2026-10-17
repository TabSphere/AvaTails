import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AvaTails Factory",
  description: "Automated kids animal-learning video factory — script, voice, visuals, render.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
