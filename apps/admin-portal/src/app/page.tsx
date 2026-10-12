import React from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';

export default function AdminPortalHomePage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <header className="mb-8">
        <Badge variant="destructive">Platform Operations</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-white mt-2">
          Marketplace Administration
        </h1>
        <p className="text-stone-400 mt-1">
          Platform-level governance, artisan KYC approvals, dispute arbitration, and audit controls.
        </p>
      </header>

      <Card className="text-stone-900">
        <h2 className="text-xl font-semibold mb-2">Artisan Verification Queue</h2>
        <p className="text-stone-600 mb-4">
          Review pending artisan storefront applications, inspect private KYC documents, and enforce
          compliance.
        </p>
        <div className="flex gap-4">
          <Link href="/sellers">
            <Button variant="primary">Review Pending Sellers</Button>
          </Link>
          <Link href="/moderation">
            <Button variant="secondary">Product Moderation Queue</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
