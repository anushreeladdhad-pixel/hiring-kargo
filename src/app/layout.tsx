import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kargo Hiring',
  description: 'Internal CV scoring, briefing, and outreach dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold text-ink text-sm">
              Kargo Hiring
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/" className="hover:text-ink">Dashboard</Link>
              <Link href="/upload" className="hover:text-ink">Upload CV</Link>
            </nav>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
