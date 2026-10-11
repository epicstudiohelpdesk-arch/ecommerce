import React from 'react';

export const metadata = {
  title: 'Handcrafted Marketplace | Authentic Artisans',
  description: 'Original handmade products by independent artists and craftspeople.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
