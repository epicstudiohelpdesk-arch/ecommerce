import React from 'react';
import { Button, Badge, Card } from '@repo/ui';
import { formatCurrency } from '@repo/shared';

export default function StorefrontHomePage() {
  const samplePrice = formatCurrency(4500, 'USD');

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <header className="mb-8">
        <Badge variant="success">Marketplace Online</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 mt-2">
          Handcrafted Marketplace
        </h1>
        <p className="text-stone-600 mt-1">
          Discover original handcrafted creations directly from independent artisans.
        </p>
      </header>

      <Card>
        <h2 className="text-xl font-semibold text-stone-900 mb-2">Featured Artisan Craft</h2>
        <p className="text-stone-600 mb-4">Handmade Ceramic Bowl - Starting at {samplePrice}</p>
        <Button variant="primary">Explore Catalog</Button>
      </Card>
    </main>
  );
}
