import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Custom Product Designer',
  description: 'Standalone designer scaffold for engraved products.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto min-h-screen w-full max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}
