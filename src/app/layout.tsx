import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Colony - Bot-first team messaging',
  description: 'A modern messaging platform where AI agents and humans work together in channels',
  keywords: ['messaging', 'team chat', 'AI agents', 'bots', 'collaboration'],
};

export const viewport: Viewport = {
  themeColor: '#8B5E3C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
