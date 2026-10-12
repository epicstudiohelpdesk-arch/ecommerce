import React from 'react';
import Link from 'next/link';

interface FooterProps {
  categories?: Array<{ id: string; name: string; slug: string }>;
}

export const Footer: React.FC<FooterProps> = ({ categories = [] }) => {
  return (
    <footer className="bg-stone-950 text-stone-300 border-t border-stone-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Mission */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-amber-600 text-stone-950 font-bold flex items-center justify-center text-sm">
                ✦
              </span>
              <span className="text-lg font-bold text-white tracking-tight">ArtisanCraft</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed mb-4">
              A curated multi-vendor marketplace connecting conscious patrons directly with verified
              independent potters, painters, woodcarvers, jewelers, and textile artisans.
            </p>
            <div className="p-3 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-400">
              <span className="font-semibold text-amber-400 block mb-1">Handmade Guarantee</span>
              Every product listing undergoes strict artisan authenticity verification before public
              listing.
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-4">
              Craft Traditions
            </h3>
            <ul className="space-y-2 text-xs">
              {categories.slice(0, 6).map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="hover:text-amber-300 transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/categories"
                  className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  View All Categories &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Craft Types */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-4">
              Shop by Craft Type
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/search?type=READY_TO_SHIP"
                  className="hover:text-amber-300 transition-colors"
                >
                  Ready to Ship (In Studio)
                </Link>
              </li>
              <li>
                <Link
                  href="/search?type=MADE_TO_ORDER"
                  className="hover:text-amber-300 transition-colors"
                >
                  Made to Order (Handcrafted on Demand)
                </Link>
              </li>
              <li>
                <Link
                  href="/search?type=ONE_OF_A_KIND"
                  className="hover:text-amber-300 transition-colors"
                >
                  One of a Kind (Unique Originals)
                </Link>
              </li>
              <li>
                <Link
                  href="/search?type=CUSTOMISABLE"
                  className="hover:text-amber-300 transition-colors"
                >
                  Customisable Gifts & Artwork
                </Link>
              </li>
            </ul>
          </div>

          {/* Artisan & Ecosystem Portal */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-4">
              Artisan & Partner Ecosystem
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="http://localhost:3002/onboarding"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-300 transition-colors flex items-center justify-between"
                >
                  <span>Apply as an Artisan</span>
                  <span className="text-stone-500">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:3002/products"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-300 transition-colors flex items-center justify-between"
                >
                  <span>Artisan Studio Dashboard</span>
                  <span className="text-stone-500">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:3003"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-300 transition-colors flex items-center justify-between"
                >
                  <span>Marketplace Governance Admin</span>
                  <span className="text-stone-500">↗</span>
                </a>
              </li>
            </ul>

            <div className="mt-4 p-3 bg-stone-900/60 border border-stone-800 rounded-lg text-[11px] text-stone-400">
              <span className="text-amber-300 font-semibold block mb-0.5">Gate G07 Storefront</span>
              Customer discovery, catalog filtering & product details active. Purchasing activates
              in Gate G08.
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-stone-850 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p>
            &copy; {new Date().getFullYear()} Handcrafted Marketplace Platform. All artisan rights
            reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-stone-400">
            <span>Fair Trade Direct Artisanship</span>
            <span>&bull;</span>
            <span>Ethical Sourcing</span>
            <span>&bull;</span>
            <span>Cultural Heritage Preservation</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
