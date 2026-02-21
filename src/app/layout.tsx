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

  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        {children}
        {isDevelopment ? (
          <div className="fixed bottom-2 right-2 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white">
            local-dev marker
          </div>
        ) : null}
      </body>
    </html>
  );
}
