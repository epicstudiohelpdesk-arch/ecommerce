'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { ProductDetailDto, ProductVariantDto } from '@repo/api-contracts';
import { formatMinorPrice } from '../../lib/api';
import { useCart } from '../../lib/cart-context';

interface VariantSelectorProps {
  product: ProductDetailDto;
}

export const VariantSelector: React.FC<VariantSelectorProps> = ({ product }) => {
  const { addToCart } = useCart();
  const variants = product.variants || [];
  const initialVariantId = variants.length > 0 && variants[0] ? variants[0].id : '';
  const [selectedVariantId, setSelectedVariantId] = useState<string>(initialVariantId);
  const [quantity, setQuantity] = useState<number>(1);
  const [customizationText, setCustomizationText] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [addSuccess, setAddSuccess] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  const selectedVariant: ProductVariantDto | undefined =
    variants.find((v) => v.id === selectedVariantId) || variants[0];

  const currentPriceMinor = selectedVariant ? selectedVariant.priceMinor : product.basePriceMinor;

  const totalCalculatedStock = variants.reduce(
    (sum, v) => sum + (v.inventory?.availableQuantity ?? 0),
    0,
  );

  const currentStock = selectedVariant
    ? (selectedVariant.inventory?.availableQuantity ?? 0)
    : totalCalculatedStock;

  const isOutOfStock = currentStock <= 0 && product.productType !== 'MADE_TO_ORDER';

  return (
    <div className="space-y-6">
      {/* Price Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-extrabold text-stone-900">
            {formatMinorPrice(currentPriceMinor, product.currency)}
          </span>
          <span className="text-xs text-stone-500 uppercase font-semibold">Inclusive of taxes</span>
        </div>

        {/* Stock Status Indicator */}
        <div className="mt-2 flex items-center gap-2">
          {product.productType === 'MADE_TO_ORDER' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              Made to Order &bull; Crafted by artisan upon placement
            </span>
          ) : currentStock > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              In Studio Stock &bull; {currentStock} piece{currentStock > 1 ? 's' : ''} available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              Out of Stock &bull; Artisan studio preparing next batch
            </span>
          )}
        </div>
      </div>

      {/* Variant Selection (if multiple variants exist) */}
      {variants.length > 1 && (
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
            Select Edition / Variant ({variants.length} available)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {variants.map((v) => {
              const isSelected = v.id === selectedVariantId;
              const optionLabels =
                v.attributes && Object.keys(v.attributes).length > 0
                  ? Object.entries(v.attributes)
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(', ')
                  : v.title || v.sku;

              const variantStock = v.inventory?.availableQuantity ?? 0;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'border-amber-600 bg-amber-50/50 shadow-sm ring-1 ring-amber-600'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-stone-900">{optionLabels}</span>
                    <span className="text-xs font-bold text-stone-900">
                      {formatMinorPrice(v.priceMinor, product.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span className="font-mono">SKU: {v.sku}</span>
                    <span>{variantStock > 0 ? `${variantStock} in studio` : 'Sold out'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected SKU & Dimensions Bar */}
      {selectedVariant && (
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1">
          <div className="flex justify-between">
            <span className="text-stone-500">Craft Identifier (SKU):</span>
            <span className="font-mono font-medium text-stone-900">{selectedVariant.sku}</span>
          </div>
          {selectedVariant.dimensionLengthMm > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-500">Dimensions:</span>
              <span className="font-medium text-stone-900">
                {(selectedVariant.dimensionLengthMm / 10).toFixed(1)} &times;{' '}
                {(selectedVariant.dimensionWidthMm / 10).toFixed(1)} &times;{' '}
                {(selectedVariant.dimensionHeightMm / 10).toFixed(1)} cm
              </span>
            </div>
          )}
          {selectedVariant.weightGrams > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-500">Finished Weight:</span>
              <span className="font-medium text-stone-900">{selectedVariant.weightGrams} g</span>
            </div>
          )}
        </div>
      )}

      {/* Quantity Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
          Quantity
        </label>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-stone-300 rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || isOutOfStock}
              className="px-3 py-2 text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Decrease quantity"
            >
              &minus;
            </button>
            <span className="px-4 py-2 text-sm font-semibold text-stone-900 select-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              disabled={isOutOfStock || (currentStock > 0 && quantity >= currentStock)}
              className="px-3 py-2 text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <span className="text-xs text-stone-500">
            {product.productType === 'MADE_TO_ORDER'
              ? 'Handmade on demand'
              : `Max ${Math.max(1, currentStock)} available`}
          </span>
        </div>
      </div>

      {/* Customization Input if customizable */}
      {product.isCustomizable && (
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-amber-900">
            Artisan Customisation Details (Optional)
          </label>
          <input
            type="text"
            value={customizationText}
            onChange={(e) => setCustomizationText(e.target.value)}
            placeholder="e.g. Inscription, custom initials, preferred glaze note..."
            maxLength={500}
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      )}

      {/* Cart Action Area */}
      <div className="space-y-3 pt-2">
        {addError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
            <span>{addError}</span>
            <button
              type="button"
              onClick={() => setAddError(null)}
              className="text-rose-500 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {addSuccess ? (
          <div className="space-y-2">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Added to your shopping cart!</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAddSuccess(false)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 transition-colors"
              >
                Keep Shopping
              </button>
              <Link
                href="/cart"
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <span>View Cart &bull; Checkout &rarr;</span>
              </Link>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={isOutOfStock || isAdding || !selectedVariant}
            onClick={async () => {
              if (!selectedVariant) return;
              try {
                setIsAdding(true);
                setAddError(null);
                await addToCart(
                  selectedVariant.id,
                  quantity,
                  customizationText.trim() ? customizationText.trim() : undefined,
                );
                setAddSuccess(true);
              } catch (err) {
                setAddError((err as Error).message || 'Failed to add item to cart');
              } finally {
                setIsAdding(false);
              }
            }}
            className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
              isOutOfStock
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-300'
                : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white border border-amber-700 cursor-pointer'
            }`}
          >
            {isAdding ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Adding to Cart...
              </span>
            ) : isOutOfStock ? (
              <span>Out of Stock</span>
            ) : (
              <span>
                🛍️ Add to Cart &bull;{' '}
                {formatMinorPrice(currentPriceMinor * quantity, product.currency)}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
