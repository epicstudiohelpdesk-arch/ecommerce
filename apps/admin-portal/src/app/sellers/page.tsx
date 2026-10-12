'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';
import type { SellerApplicationSummary } from '@repo/api-contracts';

const MOCK_APPLICATIONS: SellerApplicationSummary[] = [
  {
    sellerId: 'sel-1001',
    userId: 'usr-2001',
    userEmail: 'meera.pottery@artisan.local',
    userFullName: 'Meera Sharma',
    legalName: 'Meera Ceramics Studio',
    businessType: 'INDIVIDUAL',
    shopName: 'Terracotta Whispers',
    shopSlug: 'terracotta-whispers',
    verificationStatus: 'PENDING_REVIEW',
    documentCount: 2,
    submittedAt: '2026-10-12T08:30:00.000Z',
    createdAt: '2026-10-12T07:15:00.000Z',
  },
  {
    sellerId: 'sel-1002',
    userId: 'usr-2002',
    userEmail: 'karan.woodcraft@artisan.local',
    userFullName: 'Karan Verma',
    legalName: 'Teak Heritage Woodcrafts',
    businessType: 'SOLE_PROPRIETORSHIP',
    shopName: 'Teak & Chisel',
    shopSlug: 'teak-and-chisel',
    verificationStatus: 'PENDING_REVIEW',
    documentCount: 1,
    submittedAt: '2026-10-12T09:15:00.000Z',
    createdAt: '2026-10-12T06:00:00.000Z',
  },
  {
    sellerId: 'sel-1003',
    userId: 'usr-2003',
    userEmail: 'anjali.textiles@artisan.local',
    userFullName: 'Anjali Devi',
    legalName: 'Devi Handloom Weaves',
    businessType: 'REGISTERED_COMPANY',
    shopName: 'Varanasi Silks & Loom',
    shopSlug: 'varanasi-silks',
    verificationStatus: 'VERIFIED',
    documentCount: 3,
    submittedAt: '2026-10-10T14:20:00.000Z',
    createdAt: '2026-10-10T10:00:00.000Z',
  },
  {
    sellerId: 'sel-1004',
    userId: 'usr-2004',
    userEmail: 'ravi.clay@artisan.local',
    userFullName: 'Ravi Kumar',
    legalName: 'Ravi Kumar Terracotta',
    businessType: 'INDIVIDUAL',
    shopName: 'Clay Wonders',
    shopSlug: 'clay-wonders',
    verificationStatus: 'REJECTED',
    documentCount: 1,
    submittedAt: '2026-10-09T11:00:00.000Z',
    createdAt: '2026-10-09T08:00:00.000Z',
  },
];

export default function AdminSellerReviewPage() {
  const [applications, setApplications] = useState<SellerApplicationSummary[]>(MOCK_APPLICATIONS);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSeller, setSelectedSeller] = useState<SellerApplicationSummary | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'ALL' || app.verificationStatus === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      app.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleDecision = (
    decision: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED' | 'SUSPENDED' | 'REINSTATED',
  ) => {
    if (!selectedSeller) return;

    if (
      (decision === 'REJECTED' || decision === 'ACTION_REQUIRED' || decision === 'SUSPENDED') &&
      (!decisionNotes || decisionNotes.length < 5)
    ) {
      alert(
        'A detailed note of at least 5 characters is mandatory when rejecting, requesting action, or suspending.',
      );
      return;
    }

    let nextStatus: 'VERIFIED' | 'REJECTED' | 'DRAFT' | 'SUSPENDED';
    let message = '';

    if (decision === 'APPROVED') {
      nextStatus = 'VERIFIED';
      message = `Artisan application for "${selectedSeller.shopName}" has been APPROVED. User promoted to APPROVED_SELLER role.`;
    } else if (decision === 'REJECTED') {
      nextStatus = 'REJECTED';
      message = `Application for "${selectedSeller.shopName}" has been REJECTED. Notes dispatched to applicant.`;
    } else if (decision === 'ACTION_REQUIRED') {
      nextStatus = 'DRAFT';
      message = `Action requested for "${selectedSeller.shopName}". Application returned to DRAFT status for corrections.`;
    } else if (decision === 'SUSPENDED') {
      nextStatus = 'SUSPENDED';
      message = `Seller "${selectedSeller.shopName}" has been SUSPENDED. All storefront publishing and payouts disabled.`;
    } else {
      nextStatus = 'VERIFIED';
      message = `Seller "${selectedSeller.shopName}" has been REINSTATED to active status.`;
    }

    setApplications((prev) =>
      prev.map((a) =>
        a.sellerId === selectedSeller.sellerId ? { ...a, verificationStatus: nextStatus } : a,
      ),
    );

    setSelectedSeller((prev) => (prev ? { ...prev, verificationStatus: nextStatus } : null));
    setDecisionFeedback(message);
    setDecisionNotes('');
  };

  return (
    <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm font-medium text-amber-500 hover:text-amber-400 mb-2 inline-block"
        >
          ← Back to Platform Control Plane
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Seller Verification & Compliance Review
            </h1>
            <p className="text-stone-400 mt-1">
              Adjudicate artisan applications, inspect private KYC documents, and enforce authentic
              handcrafted standards.
            </p>
          </div>
          <Badge variant="destructive">Authorized Staff Only</Badge>
        </div>
      </div>

      {decisionFeedback && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-sm flex justify-between items-center">
          <span>✓ {decisionFeedback}</span>
          <button
            onClick={() => setDecisionFeedback(null)}
            className="text-emerald-400 hover:text-white font-bold text-xs"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-colors ${
                statusFilter === status
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by legal name, shop, email..."
            className="w-full px-3 py-1.5 rounded-md bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Applications List */}
        <div className={`${selectedSeller ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm text-stone-300">
              <thead className="bg-stone-800/80 text-xs uppercase tracking-wider text-stone-400 border-b border-stone-700">
                <tr>
                  <th className="py-3 px-4">Artisan & Shop</th>
                  <th className="py-3 px-4">Structure</th>
                  <th className="py-3 px-4">Docs</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-500">
                      No seller applications found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr
                      key={app.sellerId}
                      className={`hover:bg-stone-800/50 transition-colors ${
                        selectedSeller?.sellerId === app.sellerId ? 'bg-stone-800/80' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{app.shopName}</div>
                        <div className="text-xs text-stone-400">
                          {app.legalName} • {app.userEmail}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-stone-300">
                        {app.businessType}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="px-2 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-300">
                          {app.documentCount} Doc(s)
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {app.verificationStatus === 'PENDING_REVIEW' && (
                          <Badge variant="warning">Pending Review</Badge>
                        )}
                        {app.verificationStatus === 'VERIFIED' && (
                          <Badge variant="success">Verified</Badge>
                        )}
                        {app.verificationStatus === 'REJECTED' && (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                        {app.verificationStatus === 'SUSPENDED' && (
                          <Badge variant="destructive">Suspended</Badge>
                        )}
                        {app.verificationStatus === 'DRAFT' && (
                          <Badge variant="default">Draft</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-400">
                        {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'Draft'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedSeller(app)}
                        >
                          Review →
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Application Review Panel */}
        {selectedSeller && (
          <div className="lg:col-span-1">
            <Card className="bg-stone-900 border-stone-700 text-stone-200 p-6 space-y-6">
              <div className="flex items-start justify-between border-b border-stone-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedSeller.shopName}</h2>
                  <p className="text-xs text-stone-400 font-mono">
                    Slug: {selectedSeller.shopSlug}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSeller(null)}
                  className="text-stone-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-stone-500 uppercase tracking-wider block font-semibold">
                    Artisan / Legal Entity
                  </span>
                  <span className="text-stone-200 font-medium text-sm">
                    {selectedSeller.legalName}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 uppercase tracking-wider block font-semibold">
                    User Account
                  </span>
                  <span className="text-stone-300">
                    {selectedSeller.userFullName} ({selectedSeller.userEmail})
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 uppercase tracking-wider block font-semibold">
                    Current Lifecycle Status
                  </span>
                  <span className="text-amber-400 font-bold">
                    {selectedSeller.verificationStatus}
                  </span>
                </div>
              </div>

              {/* Private KYC Document Links */}
              <div className="border-t border-stone-800 pt-4 space-y-2">
                <span className="text-xs text-stone-400 uppercase tracking-wider font-semibold block">
                  Private KYC Documents ({selectedSeller.documentCount})
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded bg-stone-800 border border-stone-700 text-xs">
                    <span className="truncate">artisan_handicraft_card.pdf</span>
                    <a
                      href={`/api/v1/storage/download?ticket=demo&seller=${selectedSeller.sellerId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 hover:text-amber-300 underline font-medium ml-2"
                    >
                      5m Secure Link ↗
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-stone-500">
                  KYC documents are signed with short-lived HMAC tickets and never exposed publicly.
                </p>
              </div>

              {/* Segregation of duties alert */}
              <div className="p-3 bg-stone-800/60 border border-stone-700 rounded text-[11px] text-stone-400">
                🔒 <strong>Segregation of Duties Enforced:</strong> Operators cannot adjudicate
                their own seller accounts.
              </div>

              {/* Review Actions */}
              <div className="border-t border-stone-800 pt-4 space-y-3">
                <label className="block text-xs font-semibold text-stone-400">
                  Review Notes / Regulatory Feedback (Required for Reject & Action-Required)
                </label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-stone-950 border border-stone-700 text-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Enter specific feedback or reason..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {selectedSeller.verificationStatus === 'PENDING_REVIEW' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={() => handleDecision('APPROVED')}
                      >
                        ✓ Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDecision('ACTION_REQUIRED')}
                      >
                        Request Changes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="col-span-2 border-rose-700 text-rose-400 hover:bg-rose-950"
                        onClick={() => handleDecision('REJECTED')}
                      >
                        ✕ Reject Application
                      </Button>
                    </>
                  )}

                  {selectedSeller.verificationStatus === 'VERIFIED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="col-span-2 border-rose-700 text-rose-400 hover:bg-rose-950"
                      onClick={() => handleDecision('SUSPENDED')}
                    >
                      ⚠ Suspend Seller Account
                    </Button>
                  )}

                  {selectedSeller.verificationStatus === 'SUSPENDED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="col-span-2 bg-emerald-600 hover:bg-emerald-500"
                      onClick={() => handleDecision('REINSTATED')}
                    >
                      ✓ Reinstate Seller
                    </Button>
                  )}

                  {(selectedSeller.verificationStatus === 'REJECTED' ||
                    selectedSeller.verificationStatus === 'DRAFT') && (
                    <div className="col-span-2 text-xs text-stone-400 text-center py-2">
                      Application awaiting seller edits and resubmission.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
