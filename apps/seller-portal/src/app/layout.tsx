import React from 'react';

export const metadata = {
  title: 'Seller Dashboard | Artisan Multi-Vendor Hub',
  description: 'Artisan studio and order operations management.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-100 text-stone-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
