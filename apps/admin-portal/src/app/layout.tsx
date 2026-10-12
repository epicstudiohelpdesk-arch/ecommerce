import React from 'react';
import { AdminHeader } from '../components/layout/admin-header';
import { AdminFooter } from '../components/layout/admin-footer';
import './globals.css';

export const metadata = {
  title: 'Admin Console | Multi-Vendor Marketplace',
  description: 'Marketplace platform operations, moderation, audit, and governance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-900 text-stone-100 antialiased font-sans flex flex-col justify-between">
        <AdminHeader />
        <div className="flex-1">{children}</div>
        <AdminFooter />
      </body>
    </html>
  );
}
