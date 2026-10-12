'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@repo/ui';

export const AdminHeader: React.FC = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/sellers', label: 'Artisan Verification Queue' },
    { href: '/moderation', label: 'Listing Moderation' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-stone-950 border-b border-stone-800 text-stone-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Operational Role */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-lg bg-rose-900 text-rose-200 font-bold flex items-center justify-center text-sm border border-rose-700/60 shadow-sm group-hover:bg-rose-800 transition-colors">
                🛡️
              </span>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  Platform Control Center
                </span>
                <span className="text-[10px] tracking-wider uppercase text-stone-400 font-medium">
                  Compliance & Governance
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Admin Navigation">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-stone-800 text-amber-400 border border-stone-700'
                        : 'text-stone-300 hover:text-white hover:bg-stone-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Role Badges & Context Switchers */}
          <div className="flex items-center gap-3">
            <Badge variant="destructive" size="sm" withDot>
              SUPER_ADMIN
            </Badge>
            <div className="hidden sm:flex items-center gap-2 text-xs text-stone-400 border-l border-stone-800 pl-3">
              <a
                href="http://localhost:3000"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-stone-200 hover:underline"
              >
                Storefront ↗
              </a>
              <span>&bull;</span>
              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-stone-200 hover:underline"
              >
                Seller Studio ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
