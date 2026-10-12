import React from 'react';
import Link from 'next/link';
import { fetchCategories, fetchProducts } from '../lib/api';
import { ProductCard } from '../components/ui/product-card';

export default async function StorefrontHomePage() {
  const [categories, newestProductsRes, readyToShipRes] = await Promise.all([
    fetchCategories(),
    fetchProducts({ limit: 8, sort: 'newest' }),
    fetchProducts({ limit: 4, productType: 'READY_TO_SHIP' }),
  ]);

  const newestProducts = newestProductsRes.items;
  const readyToShipProducts = readyToShipRes.items;

  return (
    <main className="space-y-16 pb-16">
      {/* Editorial Hero Section */}
      <section className="relative bg-gradient-to-b from-stone-900 via-stone-850 to-stone-900 text-stone-100 py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-stone-800">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-700/50 text-amber-300 text-xs font-semibold tracking-wide uppercase">
            <span>✦</span> Handcrafted Multi-Vendor Marketplace
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Original Handcrafted Art &amp; Craft, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
              Direct from Independent Artisans
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-stone-300 leading-relaxed font-normal">
            Discover wheel-thrown ceramics, hand-painted canvases, carved hardwoods, sculpted
            jewellery, and handloomed textiles. Every creation is authentically crafted by vetted
            independent creators.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/categories"
              className="px-6 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm shadow-lg hover:shadow-amber-600/20 transition-all"
            >
              Explore Craft Categories &rarr;
            </Link>
            <Link
              href="/search?type=READY_TO_SHIP"
              className="px-6 py-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold text-sm border border-stone-700 transition-all"
            >
              Ready to Ship Crafts
            </Link>
          </div>

          {/* Value Props / Guarantees */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 border-t border-stone-800/80 text-left">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-900/40 border border-amber-700/40 flex items-center justify-center text-amber-300 font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Vetted Artisan Guild</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Every seller undergoes mandatory identity &amp; studio verification.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-900/40 border border-amber-700/40 flex items-center justify-center text-amber-300 font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">100% Genuine Handcrafted</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Zero mass factory goods. Verified materials, techniques, and provenance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-900/40 border border-amber-700/40 flex items-center justify-center text-amber-300 font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Direct Artisan Support</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Fair marketplace commission structure ensuring artists retain full value.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Discovery */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Curated Craft Disciplines
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900 mt-1">
              Browse by Craft Tradition
            </h2>
          </div>
          <Link
            href="/categories"
            className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1"
          >
            <span>All Categories</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="p-8 bg-stone-100 rounded-2xl text-center text-stone-500 text-sm">
            Craft categories are currently synchronising with the backend catalog service.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group p-5 bg-white rounded-2xl border border-stone-200 hover:border-amber-600 hover:shadow-md transition-all text-center flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-amber-50 group-hover:bg-amber-100 text-amber-800 flex items-center justify-center text-xl mb-3 transition-colors">
                  🏺
                </div>
                <h3 className="font-semibold text-stone-900 text-xs group-hover:text-amber-900 transition-colors line-clamp-2">
                  {cat.name}
                </h3>
                <span className="text-[10px] text-stone-400 mt-1">View Crafts &rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Newest Creations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Fresh From The Studios
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900 mt-1">
              Newest Artisan Creations
            </h2>
          </div>
          <Link
            href="/search?sort=newest"
            className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1"
          >
            <span>View All New</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {newestProducts.length === 0 ? (
          <div className="p-12 bg-white rounded-2xl border border-stone-200 text-center text-stone-500">
            <p className="text-sm font-medium text-stone-700">No published crafts found yet.</p>
            <p className="text-xs text-stone-500 mt-1">
              Artisan submissions approved by marketplace moderation will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {newestProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Ready to Ship Spotlight */}
      {readyToShipProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-10 rounded-3xl bg-amber-50 border border-amber-200">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Immediate Dispatch
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-stone-900 mt-1">
                  Ready to Ship from the Workshop
                </h2>
                <p className="text-xs text-stone-600 mt-1 max-w-xl">
                  Finished original pieces currently stocked in artisan studios, ready for immediate
                  packaging.
                </p>
              </div>
              <Link
                href="/search?type=READY_TO_SHIP"
                className="text-xs font-semibold text-amber-900 hover:underline"
              >
                Browse All Ready to Ship &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {readyToShipProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Artisan Heritage & Ethics Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-stone-900 rounded-3xl p-8 sm:p-12 text-stone-100 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Artisan First Economics
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Preserving Craft Traditions, One Original Piece at a Time
            </h2>
            <p className="text-stone-300 text-sm leading-relaxed">
              Every purchase directly sustains traditional studios, master artisans, and creative
              entrepreneurs. Learn how our multi-vendor platform verifies authenticity, provides
              transparent pricing, and protects customer trust.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-shrink-0">
            <a
              href="http://localhost:3002/onboarding"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs text-center transition-all"
            >
              Artisan Onboarding Studio &rarr;
            </a>
            <Link
              href="/categories"
              className="px-5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs text-center border border-stone-700 transition-all"
            >
              Explore All Crafts
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
