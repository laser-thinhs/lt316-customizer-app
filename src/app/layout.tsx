import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LT316 Proof Builder",
  description: "Layer 1 foundation for cylindrical product proofing"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
