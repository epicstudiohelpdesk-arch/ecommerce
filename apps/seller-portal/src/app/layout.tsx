import React from 'react';
import { SellerHeader } from '../components/layout/seller-header';
import { SellerFooter } from '../components/layout/seller-footer';
import './globals.css';

export const metadata = {
  title: 'Seller Dashboard | Artisan Multi-Vendor Hub',
  description: 'Artisan studio and order operations management.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-100 text-stone-900 antialiased font-sans flex flex-col justify-between">
        <SellerHeader />
        <div className="flex-1">{children}</div>
        <SellerFooter />
      </body>
    </html>
  );
}
