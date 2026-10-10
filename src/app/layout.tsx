import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Actual Budget · Overview',
  description: 'Overview dashboard for Actual Budget: KPIs, monthly summary, categories, tags and transactions.',
};

export const viewport: Viewport = {
  themeColor: '#0a0e15',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0a0e15] text-[#e6ebf2] font-sans">{children}</body>
    </html>
  );
}
