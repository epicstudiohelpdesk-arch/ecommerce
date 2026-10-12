'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../lib/cart-context';

interface HeaderProps {
  categories?: Array<{ id: string; name: string; slug: string }>;
}

export const Header: React.FC<HeaderProps> = ({ categories = [] }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { itemsCount } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-stone-900 text-stone-100 shadow-md border-b border-stone-800">
      {/* Top Banner */}
      <div className="bg-amber-900/60 border-b border-amber-800/40 px-4 py-1.5 text-center text-xs text-amber-200">
        <p className="font-medium">
          Authentic Handcrafted Marketplace &bull; 100% Verified Artisan Workshop Creations
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-full bg-amber-600 text-stone-950 font-bold flex items-center justify-center text-lg shadow-sm group-hover:bg-amber-500 transition-colors">
                ✦
              </span>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white group-hover:text-amber-300 transition-colors">
                  ArtisanCraft
                </span>
                <span className="text-[10px] tracking-wider uppercase text-stone-400">
                  Handcrafted Marketplace
                </span>
              </div>
            </Link>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-lg mx-6">
            <form action="/search" method="GET" className="w-full relative">
              <input
                type="search"
                name="q"
                placeholder="Search pottery, paintings, woodcraft, jewellery..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 text-sm bg-stone-800/80 border border-stone-700 rounded-full text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-stone-850"
                aria-label="Search handcrafted products"
              />
              <span className="absolute left-3.5 top-2.5 text-stone-400 text-sm select-none">
                🔍
              </span>
              <button
                type="submit"
                className="absolute right-1.5 top-1 px-3 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-full transition-colors"
              >
                Search
              </button>
            </form>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-300">
            <Link href="/categories" className="hover:text-amber-400 transition-colors">
              All Categories
            </Link>
            <Link
              href="/search?type=READY_TO_SHIP"
              className="hover:text-amber-400 transition-colors"
            >
              Ready to Ship
            </Link>
            <Link
              href="/search?type=ONE_OF_A_KIND"
              className="hover:text-amber-400 transition-colors"
            >
              One of a Kind
            </Link>
            <Link
              href="/search?type=MADE_TO_ORDER"
              className="hover:text-amber-400 transition-colors"
            >
              Made to Order
            </Link>
          </nav>

          {/* Right Action Links */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/cart"
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stone-800 text-stone-200 hover:text-white hover:bg-stone-700 transition-colors border border-stone-700"
              aria-label={`Shopping cart with ${itemsCount} items`}
            >
              <span className="text-sm">🛍️</span>
              <span className="text-xs font-semibold">Cart</span>
              {itemsCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-stone-900 bg-amber-400 rounded-full">
                  {itemsCount}
                </span>
              )}
            </Link>
            <div className="h-4 w-px bg-stone-700" />
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-md border border-stone-700 text-stone-300 hover:text-white hover:border-stone-500 transition-colors"
            >
              Seller Studio ↗
            </a>
            <div className="h-4 w-px bg-stone-700" />
            <a
              href="http://localhost:3002"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-md bg-stone-800 text-stone-300 hover:text-white transition-colors"
            >
              Admin ↗
            </a>
          </div>

          {/* Mobile Cart & Menu Buttons */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/cart"
              className="relative p-2 text-stone-300 hover:text-white focus:outline-none"
              aria-label={`Shopping cart with ${itemsCount} items`}
            >
              <span className="text-lg">🛍️</span>
              {itemsCount > 0 && (
                <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-stone-900 bg-amber-400 rounded-full">
                  {itemsCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-stone-400 hover:text-white focus:outline-none"
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-3 pt-1">
          <form action="/search" method="GET" className="w-full relative">
            <input
              type="search"
              name="q"
              placeholder="Search handcrafted items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-9 text-sm bg-stone-850 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Search handcrafted products"
            />
            <span className="absolute left-3 top-2.5 text-stone-400 text-xs">🔍</span>
          </form>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-800 bg-stone-900 px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Browse Marketplace
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link
                href="/categories"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200"
              >
                All Categories
              </Link>
              <Link
                href="/search?type=READY_TO_SHIP"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200"
              >
                Ready to Ship
              </Link>
              <Link
                href="/search?type=ONE_OF_A_KIND"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200"
              >
                One of a Kind
              </Link>
              <Link
                href="/search?type=MADE_TO_ORDER"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200"
              >
                Made to Order
              </Link>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Popular Categories
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {categories.slice(0, 6).map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/categories/${cat.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-stone-800 flex flex-col gap-2">
            <a
              href="http://localhost:3001"
              className="text-xs text-center py-2 px-3 rounded bg-amber-800 text-amber-100 font-medium hover:bg-amber-700"
            >
              Seller Studio Portal ↗
            </a>
            <a
              href="http://localhost:3002"
              className="text-xs text-center py-2 px-3 rounded bg-stone-800 text-stone-300 hover:text-white"
            >
              Admin Control Center ↗
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
