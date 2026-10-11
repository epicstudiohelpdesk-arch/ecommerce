import React from 'react';

export const metadata = {
  title: 'Admin Console | Multi-Vendor Marketplace',
  description: 'Marketplace platform operations, moderation, audit, and governance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-900 text-stone-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
