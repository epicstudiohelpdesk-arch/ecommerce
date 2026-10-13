'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@repo/ui';

export const AdminHeader: React.FC = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/sellers', label: 'Sellers & KYC' },
    { href: '/moderation', label: 'Moderation' },
    { href: '/orders', label: 'Orders' },
    { href: '/shipments', label: 'Shipments' },
    { href: '/finances', label: 'Finances' },
    { href: '/staff', label: 'Staff Accounts' },
    { href: '/audit', label: 'Audit Logs' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-stone-950 border-b border-stone-800 text-stone-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Operational Title */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <span className="w-8 h-8 rounded-lg bg-rose-900 text-rose-200 font-bold flex items-center justify-center text-sm border border-rose-700/60 shadow-sm group-hover:bg-rose-800 transition-colors">
                🛡️
              </span>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  Control Center
                </span>
                <span className="text-[10px] tracking-wider uppercase text-stone-400 font-medium">
                  Agency & Operations
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav
              className="hidden lg:flex items-center gap-1 overflow-x-auto"
              aria-label="Admin Navigation"
            >
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
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

        {/* Mobile / Tablet Horizontal Navigation Bar */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-stone-900 no-scrollbar">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-stone-800 text-amber-400 font-semibold'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
};
