import React from 'react';

export const AdminFooter: React.FC = () => {
  return (
    <footer className="border-t border-stone-800 bg-stone-950 py-5 mt-16 text-center text-xs text-stone-400">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-mono text-[11px] text-stone-400">
          🔒 System Governance & Security: All administrative actions recorded in immutable
          PostgreSQL audit_logs.
        </p>
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span>Security Policy</span>
          <span>&bull;</span>
          <span>Boundary Policy</span>
          <span>&bull;</span>
          <span className="font-mono text-[11px] text-emerald-400">Status: HEALTHY</span>
        </div>
      </div>
    </footer>
  );
};
