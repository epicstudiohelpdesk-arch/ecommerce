import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchProducts } from '../../lib/api';
import type { ProductType, ListPublicCatalogQuery } from '@repo/validation';
import { Breadcrumbs } from '../../components/ui/breadcrumbs';
import { ProductCard } from '../../components/ui/product-card';
import { EmptyState } from '../../components/ui/empty-state';

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = sp.q?.trim() || '';

  return {
    title: q ? `Search results for "${q}"` : 'Search Handcrafted Catalog',
    description: `Explore authentic handcrafted creations matching your search on the multi-vendor artisan marketplace.`,
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const query = sp.q?.trim() || '';
  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const productType = sp.type as ProductType | undefined;
  const sort = sp.sort as ListPublicCatalogQuery['sort'];

  const productsRes = await fetchProducts({
    search: query || undefined,
    productType,
    sort,
    page,
    limit: 12,
  });

  const { items: products, meta } = productsRes;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Breadcrumbs items={[{ label: 'Search Results' }]} />

      {/* Search Header & Query Form */}
      <div className="bg-stone-900 rounded-3xl p-6 sm:p-10 text-white shadow-md">
        <div className="max-w-2xl space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Catalogue Search
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {query ? (
              <span>
                Search results for <span className="text-amber-400">&ldquo;{query}&rdquo;</span>
              </span>
            ) : (
              <span>Explore All Handcrafted Creations</span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-stone-300">
            Search across master artisan workshops, wheel-thrown pottery, original paintings,
            jewellery, and custom woodwork.
          </p>

          <form action="/search" method="GET" className="relative pt-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by craft technique, material, or artisan..."
              className="w-full px-5 py-3 pl-11 rounded-2xl bg-stone-800 border border-stone-700 text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="absolute left-4 top-5 text-stone-400">🔍</span>
            <button
              type="submit"
              className="absolute right-2 top-3 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Filter and Sorting Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Craft Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-stone-500 mr-1">Craft Type:</span>
          {[
            { label: 'All', val: undefined },
            { label: 'Ready to Ship', val: 'READY_TO_SHIP' },
            { label: 'Made to Order', val: 'MADE_TO_ORDER' },
            { label: 'One of a Kind', val: 'ONE_OF_A_KIND' },
            { label: 'Customisable', val: 'CUSTOMISABLE' },
          ].map((item) => {
            const isActive = (!sp.type && !item.val) || sp.type === item.val;
            const queryParams = new URLSearchParams();
            if (query) queryParams.set('q', query);
            if (item.val) queryParams.set('type', item.val);
            if (sp.sort) queryParams.set('sort', sp.sort);

            return (
              <Link
                key={item.label}
                href={`/search?${queryParams.toString()}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-800 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-xs font-semibold text-stone-500">Sort:</span>
          <div className="flex gap-1 text-xs">
            {[
              { label: 'Newest', val: 'newest' },
              { label: 'Price: Low-High', val: 'price_asc' },
              { label: 'Price: High-Low', val: 'price_desc' },
              { label: 'Title: A-Z', val: 'title_asc' },
            ].map((sortItem) => {
              const isSelected =
                (!sp.sort && sortItem.val === 'newest') || sp.sort === sortItem.val;
              const queryParams = new URLSearchParams();
              if (query) queryParams.set('q', query);
              if (sp.type) queryParams.set('type', sp.type);
              queryParams.set('sort', sortItem.val);

              return (
                <Link
                  key={sortItem.val}
                  href={`/search?${queryParams.toString()}`}
                  className={`px-2.5 py-1.5 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-stone-900 text-white font-semibold'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {sortItem.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Count Banner */}
      <div className="flex items-center justify-between text-xs text-stone-500 px-1">
        <p>
          Found <span className="font-semibold text-stone-900">{meta.total}</span> handcrafted
          creation{meta.total === 1 ? '' : 's'}
        </p>
      </div>

      {/* Products Grid or Empty State */}
      {products.length === 0 ? (
        <EmptyState
          title={query ? `No creations found for "${query}"` : 'No creations found'}
          description="Try broadening your search keywords, clearing your filter options, or explore our curated craft categories."
          actionLabel="Browse All Categories"
          actionHref="/categories"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-8 border-t border-stone-200">
          {page > 1 ? (
            <Link
              href={`/search?page=${page - 1}${query ? `&q=${encodeURIComponent(query)}` : ''}${sp.type ? `&type=${sp.type}` : ''}${sp.sort ? `&sort=${sp.sort}` : ''}`}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800"
            >
              &larr; Previous Page
            </Link>
          ) : (
            <span className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-100 text-stone-400 cursor-not-allowed">
              &larr; Previous Page
            </span>
          )}

          <span className="text-xs text-stone-600 font-medium">
            Page {page} of {meta.totalPages}
          </span>

          {page < meta.totalPages ? (
            <Link
              href={`/search?page=${page + 1}${query ? `&q=${encodeURIComponent(query)}` : ''}${sp.type ? `&type=${sp.type}` : ''}${sp.sort ? `&sort=${sp.sort}` : ''}`}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800"
            >
              Next Page &rarr;
            </Link>
          ) : (
            <span className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-100 text-stone-400 cursor-not-allowed">
              Next Page &rarr;
            </span>
          )}
        </div>
      )}
    </main>
  );
}
