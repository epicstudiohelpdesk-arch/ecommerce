import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchCategories } from '../../lib/api';
import { Breadcrumbs } from '../../components/ui/breadcrumbs';

export const metadata: Metadata = {
  title: 'All Craft Categories',
  description:
    'Browse all handcrafted product categories including pottery, paintings, woodcraft, jewellery, textiles, and customised gifts.',
};

export default async function CategoriesPage() {
  const categories = await fetchCategories();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Breadcrumbs items={[{ label: 'Categories' }]} />

      <header className="space-y-2 border-b border-stone-200 pb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
          Artisan Disciplines
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
          Explore Handcrafted Categories
        </h1>
        <p className="text-sm text-stone-600 max-w-2xl">
          Discover original works categorized by artisanal material, traditional technique, and
          studio discipline. Every piece is handcrafted by verified independent makers.
        </p>
      </header>

      {categories.length === 0 ? (
        <div className="py-16 text-center text-stone-500 bg-white rounded-2xl border border-stone-200">
          <p className="text-sm font-semibold">No active categories found.</p>
          <p className="text-xs text-stone-400 mt-1">
            Categories will appear once loaded into the marketplace database.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group p-6 bg-white rounded-2xl border border-stone-200 hover:border-amber-600 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-800 flex items-center justify-center text-2xl mb-4 transition-colors">
                  ✦
                </div>
                <h2 className="text-lg font-bold text-stone-900 group-hover:text-amber-900 transition-colors">
                  {cat.name}
                </h2>
                <p className="text-xs text-stone-500 mt-2 line-clamp-3">
                  {cat.description ||
                    `Explore handcrafted ${cat.name.toLowerCase()} created with authentic traditional artisan techniques.`}
                </p>
              </div>

              <div className="pt-6 mt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-amber-800">
                <span>Browse Collection</span>
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
