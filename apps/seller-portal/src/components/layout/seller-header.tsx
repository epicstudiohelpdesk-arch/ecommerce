'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@repo/ui';

export const SellerHeader: React.FC = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Studio Overview' },
    { href: '/products', label: 'Catalogue & Stock' },
    { href: '/products/new', label: '+ New Listing' },
    { href: '/onboarding', label: 'KYC & Onboarding' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Artisan Identity */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-lg bg-amber-700 text-stone-50 font-bold flex items-center justify-center text-sm shadow-sm group-hover:bg-amber-600 transition-colors">
                🏺
              </span>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-stone-900 group-hover:text-amber-700 transition-colors">
                  Artisan Studio
                </span>
                <span className="text-[10px] tracking-wider uppercase text-stone-500 font-medium">
                  Seller Operations Portal
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Seller Navigation">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Status & Storefront Switcher */}
          <div className="flex items-center gap-3">
            <Badge variant="success" size="sm" withDot>
              Verified Artisan
            </Badge>
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-stone-500 hover:text-stone-900 border border-stone-200 rounded px-2.5 py-1 hover:bg-stone-50 transition-colors flex items-center gap-1"
            >
              <span>Storefront</span>
              <span className="text-[10px]">↗</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
