import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clean n Clear | Skin routine curator',
  description: 'An MVP that uses selfie analysis and safety rules to curate a skincare routine.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
