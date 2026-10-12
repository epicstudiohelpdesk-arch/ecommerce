import React from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';

export default function SellerPortalHomePage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <header className="mb-8">
        <Badge variant="default">Artisan Workspace</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 mt-2">
          Artisan Studio Hub
        </h1>
        <p className="text-stone-600 mt-1">
          Manage your handcrafted catalog, order fulfillment, and earnings.
        </p>
      </header>

      <Card>
        <h2 className="text-xl font-semibold text-stone-900 mb-2">
          Shop Onboarding & Verification
        </h2>
        <p className="text-stone-600 mb-4">
          Complete your artisan credentials and shop details to publish handcrafted listings and
          begin selling.
        </p>
        <div className="flex gap-4">
          <Link href="/onboarding">
            <Button variant="primary">Start Onboarding Flow</Button>
          </Link>
          <Button variant="secondary" disabled>
            Product Catalog (G06)
          </Button>
        </div>
      </Card>
    </main>
  );
}
