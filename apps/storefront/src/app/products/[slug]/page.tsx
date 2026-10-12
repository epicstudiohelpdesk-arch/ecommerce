import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProductBySlug, fetchProducts } from '../../../lib/api';
import { Breadcrumbs } from '../../../components/ui/breadcrumbs';
import { ProductGallery } from '../../../components/ui/product-gallery';
import { VariantSelector } from '../../../components/ui/variant-selector';
import { ProductCard } from '../../../components/ui/product-card';

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  const primaryImage = product.media.find((m) => m.isPrimary)?.url || product.media[0]?.url;

  return {
    title: `${product.title} - Handcrafted by Independent Artisan`,
    description:
      product.description.slice(0, 160) ||
      `Authentic handcrafted ${product.title} created by verified independent artisans.`,
    openGraph: {
      title: product.title,
      description: product.description.slice(0, 160),
      images: primaryImage ? [{ url: primaryImage }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Fetch related products from the same category
  const relatedRes = await fetchProducts({
    categorySlug: product.category.slug,
    limit: 5,
  });
  const relatedProducts = relatedRes.items.filter((p) => p.id !== product.id).slice(0, 4);

  const totalCalculatedStock = (product.variants || []).reduce(
    (sum, v) => sum + (v.inventory?.availableQuantity ?? 0),
    0,
  );

  const primaryVariant =
    product.variants && product.variants.length > 0 ? product.variants[0] : undefined;

  // Schema.org JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: product.media.map((m) => m.url),
    sku: primaryVariant?.sku || product.id,
    category: product.category.name,
    offers: {
      '@type': 'Offer',
      price: (product.basePriceMinor / 100).toFixed(2),
      priceCurrency: product.currency,
      availability:
        totalCalculatedStock > 0 || product.productType === 'MADE_TO_ORDER'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: product.shop?.name || 'Handcrafted Marketplace Artisan',
      },
    },
  };

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case 'READY_TO_SHIP':
        return 'Ready to Ship from Studio';
      case 'MADE_TO_ORDER':
        return 'Made to Order (Handcrafted on Demand)';
      case 'ONE_OF_A_KIND':
        return 'One of a Kind Original';
      case 'CUSTOMISABLE':
      case 'PERSONALIZED':
        return 'Customisable Artisan Piece';
      default:
        return 'Handcrafted Creation';
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb Trail */}
      <Breadcrumbs
        items={[
          { label: 'Categories', href: '/categories' },
          { label: product.category.name, href: `/categories/${product.category.slug}` },
          { label: product.title },
        ]}
      />

      {/* Product Overview Section (Gallery + Details) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Visual Media Gallery */}
        <div className="lg:col-span-7 space-y-6">
          <ProductGallery media={product.media} title={product.title} />

          {/* Artisan Authenticity Trust Box */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <span>✦</span> Verified Artisan Workshop Credentials
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-semibold text-stone-900">Artisan Studio</p>
                <p className="text-stone-500 mt-0.5">
                  {product.shop?.name || `Artisan ${product.sellerId}`}
                </p>
              </div>
              <div>
                <p className="font-semibold text-stone-900">Authentic Craft</p>
                <p className="text-stone-500 mt-0.5">
                  Origin: {product.countryOfOrigin || 'India'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-stone-900">Safe Packaging</p>
                <p className="text-stone-500 mt-0.5">
                  {product.isFragile
                    ? 'Fragile-grade protective packing'
                    : 'Eco-conscious packaging'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Title, Specs, Variant Selector & G08 Purchasing Notice */}
        <div className="lg:col-span-5 space-y-6">
          {/* Header & Badges */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/categories/${product.category.slug}`}
                className="text-xs font-semibold text-amber-800 hover:text-amber-900 uppercase tracking-wider"
              >
                {product.category.name}
              </Link>
              <span className="text-stone-300">&bull;</span>
              <span className="text-xs font-medium text-stone-500">
                {getProductTypeLabel(product.productType)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight leading-tight">
              {product.title}
            </h1>
          </div>

          {/* Interactive Variant Picker and Gate G08 Purchasing Notice */}
          <VariantSelector product={product} />

          {/* Lead Time Notice (if made to order) */}
          {product.productionLeadTimeDays > 0 && (
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2.5">
              <span className="text-base">⏳</span>
              <div>
                <span className="font-bold">Production Lead Time: </span>
                <span>
                  {product.productionLeadTimeDays} business days for hand fabrication before
                  shipping.
                </span>
              </div>
            </div>
          )}

          {/* Artisan Provenance & Materials Accordion */}
          <div className="space-y-4 pt-4 border-t border-stone-200 text-sm">
            {/* Story & Description */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-2">
                About This Handcrafted Piece
              </h2>
              <div className="text-stone-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-stone-200">
                {product.description}
              </div>
            </div>

            {/* Materials & Techniques */}
            {((product.materials && product.materials.length > 0) ||
              (product.techniques && product.techniques.length > 0)) && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-2">
                  Materials &amp; Traditional Techniques
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {product.materials?.map((m, idx) => (
                    <span
                      key={`mat-${idx}`}
                      className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 text-xs font-medium"
                    >
                      Material: {m}
                    </span>
                  ))}
                  {product.techniques?.map((t, idx) => (
                    <span
                      key={`tech-${idx}`}
                      className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium"
                    >
                      Technique: {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Customization instructions if customizable */}
            {product.isCustomizable && product.customizationInstructions && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">
                  Customisation Options
                </h2>
                <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 text-xs text-stone-700 leading-relaxed">
                  {product.customizationInstructions}
                </div>
              </div>
            )}

            {/* Care Instructions */}
            {product.careInstructions && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-2">
                  Care & Maintenance Instructions
                </h2>
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 leading-relaxed">
                  {product.careInstructions}
                </div>
              </div>
            )}

            {/* Dimensions & Specifications */}
            {primaryVariant &&
              (primaryVariant.dimensionLengthMm > 0 || primaryVariant.weightGrams > 0) && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-2">
                    Dimensions & Specifications
                  </h2>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {primaryVariant.dimensionLengthMm > 0 && (
                      <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                        <span className="text-stone-500 block">Dimensions</span>
                        <span className="font-semibold text-stone-900">
                          {(primaryVariant.dimensionLengthMm / 10).toFixed(1)} &times;{' '}
                          {(primaryVariant.dimensionWidthMm / 10).toFixed(1)} &times;{' '}
                          {(primaryVariant.dimensionHeightMm / 10).toFixed(1)} cm
                        </span>
                      </div>
                    )}
                    {primaryVariant.weightGrams > 0 && (
                      <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                        <span className="text-stone-500 block">Weight</span>
                        <span className="font-semibold text-stone-900">
                          {primaryVariant.weightGrams} g
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* Related Creations from this Category */}
      {relatedProducts.length > 0 && (
        <section className="pt-12 border-t border-stone-200">
          <div className="flex items-end justify-between mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Explore More Works
              </span>
              <h2 className="text-xl font-bold tracking-tight text-stone-900 mt-1">
                More in {product.category.name}
              </h2>
            </div>
            <Link
              href={`/categories/${product.category.slug}`}
              className="text-xs font-semibold text-amber-800 hover:text-amber-900"
            >
              View Category Collection &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
