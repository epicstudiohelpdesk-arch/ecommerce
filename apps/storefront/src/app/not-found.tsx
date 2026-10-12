import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto py-24 px-4 text-center space-y-6">
      <div className="w-20 h-20 mx-auto rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-3xl">
        🏺
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
          404 Not Found
        </span>
        <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
          Handcrafted Creation or Category Not Found
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          The artisan listing or craft collection you are looking for may have been archived, sold
          out, or moved to another workshop showcase.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors"
        >
          Return to Marketplace Home
        </Link>
        <Link
          href="/categories"
          className="px-5 py-2.5 rounded-xl bg-stone-100 text-stone-800 font-medium text-xs hover:bg-stone-200 transition-colors border border-stone-300"
        >
          Browse All Craft Categories
        </Link>
      </div>
    </main>
  );
}
