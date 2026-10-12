import React from 'react';
import Link from 'next/link';
import type { ProductSummaryDto } from '@repo/api-contracts';
import { formatMinorPrice } from '../../lib/api';

interface ProductCardProps {
  product: ProductSummaryDto;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const getProductTypeBadge = (type: string) => {
    switch (type) {
      case 'READY_TO_SHIP':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Ready to Ship
          </span>
        );
      case 'MADE_TO_ORDER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Made to Order
          </span>
        );
      case 'ONE_OF_A_KIND':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            One of a Kind
          </span>
        );
      case 'CUSTOMISABLE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
            Customisable
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-800">
            Handcrafted
          </span>
        );
    }
  };

  const getStockStatus = () => {
    if (product.totalStock > 0) {
      if (product.totalStock <= 3) {
        return (
          <span className="text-[11px] font-medium text-amber-700">
            Only {product.totalStock} left
          </span>
        );
      }
      return <span className="text-[11px] text-stone-500">{product.totalStock} in studio</span>;
    }
    if (product.productType === 'MADE_TO_ORDER') {
      return <span className="text-[11px] font-medium text-stone-600">Handcrafted upon order</span>;
    }
    return <span className="text-[11px] font-medium text-rose-600">Currently out of stock</span>;
  };

  return (
    <article className="group bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        {/* Media Container */}
        <Link
          href={`/products/${product.slug}`}
          className="block relative aspect-square bg-stone-100 overflow-hidden"
        >
          {product.primaryImageUrl ? (
            <img
              src={product.primaryImageUrl}
              alt={product.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400 p-4 text-center">
              <svg
                className="w-12 h-12 text-stone-300 mb-2 group-hover:text-amber-600 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
              <span className="text-xs font-medium text-stone-500">{product.category.name}</span>
              <span className="text-[10px] text-stone-400 mt-0.5">Artisan Workshop Original</span>
            </div>
          )}

          {/* Type Badge Overlay */}
          <div className="absolute top-2.5 left-2.5">
            {getProductTypeBadge(product.productType)}
          </div>
        </Link>

        {/* Content Container */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <Link
              href={`/categories/${product.category.slug}`}
              className="text-xs font-medium text-stone-500 hover:text-amber-800 transition-colors truncate"
            >
              {product.category.name}
            </Link>
          </div>

          <h3 className="font-semibold text-stone-900 text-sm leading-snug line-clamp-2 group-hover:text-amber-900 transition-colors">
            <Link href={`/products/${product.slug}`}>{product.title}</Link>
          </h3>
        </div>
      </div>

      {/* Footer Pricing & Status */}
      <div className="p-4 pt-0 border-t border-stone-100 flex items-center justify-between mt-2">
        <div>
          <p className="text-base font-bold text-stone-900">
            {formatMinorPrice(product.basePriceMinor, product.currency)}
          </p>
          {getStockStatus()}
        </div>

        <Link
          href={`/products/${product.slug}`}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors"
        >
          View &rarr;
        </Link>
      </div>
    </article>
  );
};
