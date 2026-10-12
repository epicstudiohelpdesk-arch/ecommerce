'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '../../lib/cart-context';
import { formatMinorPrice } from '../../lib/api';

export default function CartPage() {
  const { cart, isLoading, itemsCount, updateQuantity, removeItem, clearCart } = useCart();

  if (isLoading && !cart) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-12 h-12 border-4 border-amber-600/30 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-stone-600 text-sm">Loading your artisan cart...</p>
      </main>
    );
  }

  if (!cart || itemsCount === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
        <div className="w-20 h-20 bg-amber-100/70 text-amber-800 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">
          🛍️
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-stone-900">Your Shopping Cart is Empty</h1>
          <p className="text-sm text-stone-600 max-w-md mx-auto">
            You haven't added any handcrafted items to your cart yet. Discover authentic pottery,
            paintings, woodcraft, and textiles crafted by verified independent artisans.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <span>Explore Artisan Catalog &rarr;</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-200 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Artisan Shopping Cart
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            {itemsCount} piece{itemsCount > 1 ? 's' : ''} across {cart.sellerGroups.length}{' '}
            independent artisan workshop{cart.sellerGroups.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm('Are you sure you want to clear all items from your cart?')) {
              clearCart();
            }
          }}
          className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline self-start sm:self-auto"
        >
          Clear Cart
        </button>
      </div>

      {/* Warnings & Alerts */}
      {cart.hasUnavailableItems && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">⚠️</span>
          <div>
            <p className="font-bold">Item Availability Alert</p>
            <p className="mt-0.5 text-rose-800">
              One or more items in your cart are currently out of stock or no longer available.
              Please remove or update them before proceeding to checkout.
            </p>
          </div>
        </div>
      )}

      {cart.hasPriceChanges && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">ℹ️</span>
          <div>
            <p className="font-bold">Price Notice</p>
            <p className="mt-0.5 text-amber-800">
              Certain item prices have been updated to reflect the latest authoritative artisan
              studio listings.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Items grouped by Artisan Seller */}
        <div className="lg:col-span-8 space-y-6">
          {cart.sellerGroups.map((group) => {
            const qualifiesFreeShipping = group.subtotalMinor >= 100000;

            return (
              <div
                key={group.sellerId}
                className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
              >
                {/* Artisan Studio Header */}
                <div className="bg-stone-50/80 px-6 py-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    <span className="text-sm font-bold text-stone-900">
                      Studio: {group.shopName}
                    </span>
                  </div>
                  <div className="text-xs text-stone-600">
                    Shipping:{' '}
                    {qualifiesFreeShipping ? (
                      <span className="font-semibold text-emerald-700">
                        FREE (Orders &gt; ₹1,000)
                      </span>
                    ) : (
                      <span className="font-medium text-stone-900">
                        {formatMinorPrice(group.shippingFeeMinor)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Items in this group */}
                <div className="divide-y divide-stone-100">
                  {group.items.map((item) => (
                    <div key={item.id} className="p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-stone-100 rounded-xl overflow-hidden relative shrink-0 border border-stone-200">
                        {item.primaryImageUrl ? (
                          <Image
                            src={item.primaryImageUrl}
                            alt={item.productTitle}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl text-stone-300">
                            🏺
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/products/${item.productSlug}`}
                            className="text-sm sm:text-base font-bold text-stone-900 hover:text-amber-800 transition-colors"
                          >
                            {item.productTitle}
                          </Link>
                          <span className="text-sm sm:text-base font-bold text-stone-900 whitespace-nowrap">
                            {formatMinorPrice(item.lineTotalMinor)}
                          </span>
                        </div>

                        <p className="text-xs text-stone-500">
                          Edition: {item.variantTitle} &bull; SKU: {item.sku}
                        </p>

                        {item.customizationText && (
                          <p className="text-xs text-amber-900 bg-amber-50 px-2 py-1 rounded-md border border-amber-200/60 inline-block mt-1">
                            Customisation: &ldquo;{item.customizationText}&rdquo;
                          </p>
                        )}

                        {/* Stock & Availability Alerts */}
                        <div className="pt-1">
                          {!item.isAvailable ? (
                            <span className="inline-block text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Currently Unavailable
                            </span>
                          ) : item.availableStock < 5 ? (
                            <span className="inline-block text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Only {item.availableStock} remaining in studio
                            </span>
                          ) : null}
                        </div>

                        {/* Quantity and Remove controls */}
                        <div className="flex items-center justify-between pt-3">
                          <div className="flex items-center border border-stone-300 rounded-lg bg-stone-50">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 font-bold"
                              aria-label="Decrease quantity"
                            >
                              &minus;
                            </button>
                            <span className="px-3 py-1 text-xs font-semibold text-stone-900 select-none">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.availableStock || item.quantity >= 50}
                              className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 font-bold disabled:opacity-30 disabled:pointer-events-none"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-xs text-stone-400 hover:text-rose-600 transition-colors font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Seller Group Subtotal Footer */}
                <div className="bg-stone-50/50 px-6 py-3 border-t border-stone-100 flex justify-between items-center text-xs">
                  <span className="text-stone-500">Artisan Items Subtotal:</span>
                  <span className="font-bold text-stone-900">
                    {formatMinorPrice(group.subtotalMinor)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-6 sticky top-24">
            <h2 className="text-base font-bold text-stone-900 border-b border-stone-200 pb-3">
              Order Summary
            </h2>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-stone-900">
                  {formatMinorPrice(cart.subtotalMinor)}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Estimated Shipping</span>
                <span className="font-semibold text-stone-900">
                  {formatMinorPrice(cart.estimatedShippingMinor)}
                </span>
              </div>
              <div className="border-t border-stone-200 pt-3 flex justify-between text-base font-extrabold text-stone-900">
                <span>Estimated Total</span>
                <span>{formatMinorPrice(cart.totalEstimatedMinor)}</span>
              </div>
              <p className="text-[11px] text-stone-400 leading-tight">
                All prices in INR. Inclusive of standard GST and artisan studio packaging.
              </p>
            </div>

            {/* Checkout Action Button */}
            <div>
              <Link
                href={cart.hasUnavailableItems ? '#' : '/checkout'}
                aria-disabled={cart.hasUnavailableItems}
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                  cart.hasUnavailableItems
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed pointer-events-none'
                    : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer active:bg-amber-700'
                }`}
              >
                <span>Proceed to Checkout &rarr;</span>
              </Link>
            </div>

            {/* Handcrafted Trust Marks */}
            <div className="pt-4 border-t border-stone-100 space-y-3 text-xs text-stone-500">
              <div className="flex items-center gap-2">
                <span className="text-amber-600">✦</span>
                <span>Direct artisan workshop provenance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-600">🔒</span>
                <span>15-Minute atomic inventory reservation hold</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-600">📦</span>
                <span>Multi-artisan careful fulfillment</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
