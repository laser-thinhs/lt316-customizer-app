import "./globals.css";
import type { Metadata } from "next";
import { runStartupChecks } from "@/lib/startup";

export const metadata: Metadata = {
  title: "LT316 Proof Builder",
  description: "Layer 1 foundation for cylindrical product proofing"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "test") {
    await runStartupChecks();
  }

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
