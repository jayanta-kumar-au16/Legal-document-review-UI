import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clausewise | Legal Document Review",
  description: "AI-assisted NDA review prototype for human review."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}