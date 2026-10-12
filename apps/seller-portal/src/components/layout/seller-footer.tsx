import React from 'react';

export const SellerFooter: React.FC = () => {
  return (
    <footer className="border-t border-stone-200 bg-white py-6 mt-16 text-center text-xs text-stone-500">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>
          &copy; {new Date().getFullYear()} Handcrafted Marketplace &bull; Artisan Studio Operations
        </p>
        <div className="flex items-center gap-4 text-xs text-stone-500">
          <span>Artisan Care & Support</span>
          <span>&bull;</span>
          <span>Policy Guidelines</span>
          <span>&bull;</span>
          <span className="font-mono text-[11px] text-amber-700">Studio Session: Active</span>
        </div>
      </div>
    </footer>
  );
};
