import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchCategories, fetchProducts } from '../../../lib/api';
import type { ProductType, ListPublicCatalogQuery } from '@repo/validation';
import { Breadcrumbs } from '../../../components/ui/breadcrumbs';
import { ProductCard } from '../../../components/ui/product-card';
import { EmptyState } from '../../../components/ui/empty-state';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    type?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await fetchCategories();
  const category = categories.find((c) => c.slug === slug);

  if (!category) {
    return {
      title: 'Category Not Found',
    };
  }

  return {
    title: `${category.name} - Handcrafted Creations`,
    description:
      category.description ||
      `Discover authentic handcrafted ${category.name.toLowerCase()} direct from independent artisans.`,
  };
}

export default async function CategoryDetailPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const productType = sp.type as ProductType | undefined;
  const sort = sp.sort as ListPublicCatalogQuery['sort'];
  const minPriceMinor = sp.minPrice ? parseInt(sp.minPrice, 10) * 100 : undefined;
  const maxPriceMinor = sp.maxPrice ? parseInt(sp.maxPrice, 10) * 100 : undefined;

  const [categories, productsRes] = await Promise.all([
    fetchCategories(),
    fetchProducts({
      categorySlug: slug,
      page,
      limit: 12,
      productType,
      sort,
      minPriceMinor,
      maxPriceMinor,
    }),
  ]);

  const currentCategory = categories.find((c) => c.slug === slug);

  // If category does not exist in active categories, check if there are products or 404
  if (!currentCategory && productsRes.items.length === 0) {
    notFound();
  }

  const categoryName = currentCategory ? currentCategory.name : slug.replace(/-/g, ' ');
  const categoryDesc =
    currentCategory?.description ||
    `Curated handcrafted items in ${categoryName}. Verified authentic workshop creations.`;

  const { items: products, meta } = productsRes;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Breadcrumbs
        items={[{ label: 'Categories', href: '/categories' }, { label: categoryName }]}
      />

      {/* Header */}
      <header className="space-y-2 border-b border-stone-200 pb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
          Handcrafted Collection
        </span>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 capitalize">
            {categoryName}
          </h1>
          <span className="text-xs text-stone-500 font-medium">
            {meta.total} creation{meta.total === 1 ? '' : 's'} available
          </span>
        </div>
        <p className="text-sm text-stone-600 max-w-3xl">{categoryDesc}</p>
      </header>

      {/* Filter and Sorting Controls */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Craft Type Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-stone-500 mr-1">Craft Type:</span>
          {[
            { label: 'All Crafts', val: undefined },
            { label: 'Ready to Ship', val: 'READY_TO_SHIP' },
            { label: 'Made to Order', val: 'MADE_TO_ORDER' },
            { label: 'One of a Kind', val: 'ONE_OF_A_KIND' },
            { label: 'Customisable', val: 'CUSTOMISABLE' },
          ].map((item) => {
            const isActive = (!sp.type && !item.val) || sp.type === item.val;
            const queryParams = new URLSearchParams();
            if (item.val) queryParams.set('type', item.val);
            if (sp.sort) queryParams.set('sort', sp.sort);
            if (sp.minPrice) queryParams.set('minPrice', sp.minPrice);
            if (sp.maxPrice) queryParams.set('maxPrice', sp.maxPrice);

            return (
              <Link
                key={item.label}
                href={`/categories/${slug}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`}
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

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-xs font-semibold text-stone-500">Sort by:</span>
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
              if (sp.type) queryParams.set('type', sp.type);
              queryParams.set('sort', sortItem.val);
              if (sp.minPrice) queryParams.set('minPrice', sp.minPrice);
              if (sp.maxPrice) queryParams.set('maxPrice', sp.maxPrice);

              return (
                <Link
                  key={sortItem.val}
                  href={`/categories/${slug}?${queryParams.toString()}`}
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

      {/* Product Grid or Empty State */}
      {products.length === 0 ? (
        <EmptyState
          title={`No creations found in ${categoryName}`}
          description={
            sp.type
              ? 'Try clearing the selected craft type filter to discover other authentic works.'
              : 'Our verified artisans have not yet published listings in this craft category. Check back soon!'
          }
          actionLabel="View All Categories"
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
              href={`/categories/${slug}?page=${page - 1}${sp.type ? `&type=${sp.type}` : ''}${sp.sort ? `&sort=${sp.sort}` : ''}`}
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
              href={`/categories/${slug}?page=${page + 1}${sp.type ? `&type=${sp.type}` : ''}${sp.sort ? `&sort=${sp.sort}` : ''}`}
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
