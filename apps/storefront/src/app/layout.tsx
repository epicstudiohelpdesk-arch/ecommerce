import React from 'react';
import type { Metadata } from 'next';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { fetchCategories } from '../lib/api';

export const metadata: Metadata = {
  title: {
    template: '%s | Handcrafted Artisan Marketplace',
    default: 'Handcrafted Marketplace | Authentic Artisan Creations',
  },
  description:
    'Discover and purchase authentic handcrafted pottery, original paintings, woodcraft, handmade jewellery, and textiles direct from verified independent artisans.',
  keywords: [
    'handcrafted',
    'artisan marketplace',
    'handmade pottery',
    'original paintings',
    'woodcraft',
    'handmade jewellery',
    'textiles',
    'fair trade crafts',
  ],
  authors: [{ name: 'Handcrafted Marketplace Artisans' }],
  openGraph: {
    title: 'Handcrafted Marketplace | Authentic Artisan Creations',
    description:
      'Direct from independent artists and craftspeople: pottery, woodwork, paintings, textiles, and jewellery.',
    siteName: 'Handcrafted Marketplace',
    type: 'website',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await fetchCategories();

  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased font-sans flex flex-col justify-between selection:bg-amber-200 selection:text-stone-900">
        <Header categories={categories} />
        <div className="flex-1">{children}</div>
        <Footer categories={categories} />
      </body>
    </html>
  );
}
