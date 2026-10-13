'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';
import type { SellerApplicationSummary, SellerApplicationDetail } from '@repo/api-contracts';
import {
  getAdminSellers,
  getAdminSellerDetail,
  reviewSellerApplication,
  suspendSeller,
  reinstateSeller,
} from '../../lib/api';

export default function AdminSellerReviewPage() {
  const [applications, setApplications] = useState<SellerApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedSellerSummary, setSelectedSellerSummary] =
    useState<SellerApplicationSummary | null>(null);
  const [selectedSellerDetail, setSelectedSellerDetail] = useState<SellerApplicationDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);

  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminSellers({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
        limit: 50,
      });
      setApplications(res.items);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load seller applications');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleSelectSeller = async (seller: SellerApplicationSummary) => {
    setSelectedSellerSummary(seller);
    setDecisionNotes('');
    setDecisionFeedback(null);
    try {
      setDetailLoading(true);
      const detail = await getAdminSellerDetail(seller.sellerId);
      setSelectedSellerDetail(detail);
    } catch {
      setSelectedSellerDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDecision = async (
    decision: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED' | 'SUSPENDED' | 'REINSTATED',
  ) => {
    if (!selectedSellerSummary) return;

    if (
      (decision === 'REJECTED' || decision === 'ACTION_REQUIRED' || decision === 'SUSPENDED') &&
      (!decisionNotes || decisionNotes.length < 5)
    ) {
      alert(
        'A detailed note of at least 5 characters is mandatory when rejecting, requesting action, or suspending.',
      );
      return;
    }

    try {
      setSubmittingDecision(true);
      setDecisionFeedback(null);

      if (decision === 'APPROVED') {
        await reviewSellerApplication(
          selectedSellerSummary.sellerId,
          'APPROVE',
          decisionNotes || undefined,
        );
        setDecisionFeedback(`Seller "${selectedSellerSummary.legalName}" approved.`);
      } else if (decision === 'REJECTED') {
        await reviewSellerApplication(
          selectedSellerSummary.sellerId,
          'REJECT',
          decisionNotes,
          decisionNotes,
        );
        setDecisionFeedback(`Seller "${selectedSellerSummary.legalName}" rejected.`);
      } else if (decision === 'ACTION_REQUIRED') {
        await reviewSellerApplication(
          selectedSellerSummary.sellerId,
          'REQUEST_CHANGES',
          decisionNotes,
          decisionNotes,
        );
        setDecisionFeedback(`Changes requested from seller "${selectedSellerSummary.legalName}".`);
      } else if (decision === 'SUSPENDED') {
        await suspendSeller(selectedSellerSummary.sellerId, decisionNotes);
        setDecisionFeedback(`Seller "${selectedSellerSummary.legalName}" suspended.`);
      } else if (decision === 'REINSTATED') {
        await reinstateSeller(selectedSellerSummary.sellerId, decisionNotes || undefined);
        setDecisionFeedback(`Seller "${selectedSellerSummary.legalName}" reinstated.`);
      }

      setDecisionNotes('');
      await loadApplications();
      if (selectedSellerSummary) {
        const updatedDetail = await getAdminSellerDetail(selectedSellerSummary.sellerId);
        setSelectedSellerDetail(updatedDetail);
      }
    } catch (err: unknown) {
      alert(`Decision failed: ${(err as Error).message}`);
    } finally {
      setSubmittingDecision(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="success">VERIFIED</Badge>;
      case 'PENDING_REVIEW':
        return <Badge variant="warning">PENDING REVIEW</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">REJECTED</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive">SUSPENDED</Badge>;
      case 'DRAFT':
        return <Badge variant="default">DRAFT</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="text-xs font-semibold text-amber-500 hover:text-amber-400 mb-2 inline-block"
        >
          &larr; Back to Platform Overview
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Artisan Verification & KYC Workspace
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Verify identity proofs, business documents, tax declarations, and enforce compliance
              policies.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadApplications()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '↻ Refresh Queue'}
          </Button>
        </div>
      </div>

      {decisionFeedback && (
        <Card className="bg-emerald-950/40 border-emerald-800 text-emerald-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>✓</span> Action Confirmed
          </div>
          <p className="text-sm mt-1">{decisionFeedback}</p>
        </Card>
      )}

      {error && (
        <Card className="bg-rose-950/40 border-rose-800 text-rose-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span> Data Query Error
          </div>
          <p className="text-sm mt-1 text-rose-300">{error}</p>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <Card className="bg-stone-900 border-stone-800 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {['ALL', 'PENDING_REVIEW', 'VERIFIED', 'SUSPENDED', 'REJECTED', 'DRAFT'].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-amber-500 text-stone-950 font-semibold'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              ),
            )}
          </div>

          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search legal name, shop, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </Card>

      {/* Main Layout: Split Queue Table & KYC Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Queue List */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-stone-900 border-stone-800 overflow-hidden">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                Artisan Applications ({applications.length})
              </h2>
              <span className="text-xs text-stone-400">Select an artisan to inspect documents</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-stone-400 text-xs">
                Loading applications from database...
              </div>
            ) : applications.length === 0 ? (
              <div className="p-12 text-center text-stone-500 text-xs">
                No seller applications match current filter criteria.
              </div>
            ) : (
              <div className="divide-y divide-stone-800/80 max-h-[600px] overflow-y-auto">
                {applications.map((seller) => {
                  const isSelected = selectedSellerSummary?.sellerId === seller.sellerId;
                  return (
                    <div
                      key={seller.sellerId}
                      onClick={() => handleSelectSeller(seller)}
                      className={`p-4 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-950/20 border-l-4 border-amber-500'
                          : 'hover:bg-stone-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-white text-sm">{seller.legalName}</div>
                          <div className="text-xs text-stone-400">
                            {seller.shopName} &bull; {seller.businessType}
                          </div>
                          <div className="text-xs text-stone-500 mt-1">{seller.userEmail}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(seller.verificationStatus)}
                          <span className="text-[10px] text-stone-500 mt-1">
                            {seller.documentCount} docs &bull;{' '}
                            {new Date(seller.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Detailed KYC Inspector & Decision Drawer */}
        <div className="lg:col-span-5">
          {selectedSellerSummary ? (
            <Card className="bg-stone-900 border-stone-800 p-5 space-y-5 sticky top-20 text-white">
              <div className="border-b border-stone-800 pb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base">{selectedSellerSummary.legalName}</h3>
                  <p className="text-xs text-stone-400">Shop: {selectedSellerSummary.shopName}</p>
                </div>
                {getStatusBadge(
                  selectedSellerDetail?.verificationStatus ||
                    selectedSellerSummary.verificationStatus,
                )}
              </div>

              {detailLoading ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  Loading KYC documents & audit trail...
                </div>
              ) : (
                <>
                  {/* Account Information */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-stone-800/60">
                      <span className="text-stone-400">Applicant:</span>
                      <span className="font-medium">
                        {selectedSellerDetail?.userFullName || selectedSellerSummary.userFullName}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/60">
                      <span className="text-stone-400">Contact Email:</span>
                      <span className="font-medium">
                        {selectedSellerDetail?.userEmail || selectedSellerSummary.userEmail}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/60">
                      <span className="text-stone-400">Business Model:</span>
                      <span className="font-medium">{selectedSellerSummary.businessType}</span>
                    </div>
                  </div>

                  {/* KYC Documents Section */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                      Submitted Verification Documents
                    </h4>
                    {selectedSellerDetail?.documents &&
                    selectedSellerDetail.documents.length > 0 ? (
                      <div className="space-y-2">
                        {selectedSellerDetail.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-2.5 rounded bg-stone-950 border border-stone-800 text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-stone-200">
                                {doc.documentType.replace('_', ' ')}
                              </div>
                              <div className="text-[10px] text-stone-500">
                                {doc.fileName} ({Math.round(doc.fileSizeBytes / 1024)} KB)
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(doc.status)}
                              {doc.downloadUrl && (
                                <a
                                  href={doc.downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-amber-400 hover:underline bg-stone-800 px-2 py-1 rounded"
                                >
                                  View ↗
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-500 italic">
                        No KYC documents uploaded yet.
                      </p>
                    )}
                  </div>

                  {/* Action & Moderation Controls */}
                  <div className="pt-3 border-t border-stone-800 space-y-3">
                    <label className="block text-xs font-semibold text-stone-300">
                      Decision Notes / Rejection Reason (Mandatory for rejection or suspension):
                    </label>
                    <textarea
                      rows={3}
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder="Enter verification rationale or specific document corrections required..."
                      className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                    />

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={submittingDecision}
                        onClick={() => handleDecision('APPROVED')}
                      >
                        Approve & Verify
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={submittingDecision}
                        onClick={() => handleDecision('ACTION_REQUIRED')}
                      >
                        Request Changes
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={submittingDecision}
                        onClick={() => handleDecision('REJECTED')}
                      >
                        Reject
                      </Button>
                      {selectedSellerSummary.verificationStatus === 'VERIFIED' ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={submittingDecision}
                          onClick={() => handleDecision('SUSPENDED')}
                        >
                          Suspend Seller
                        </Button>
                      ) : selectedSellerSummary.verificationStatus === 'SUSPENDED' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={submittingDecision}
                          onClick={() => handleDecision('REINSTATED')}
                        >
                          Reinstate Seller
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </Card>
          ) : (
            <Card className="bg-stone-900 border-stone-800 p-8 text-center text-stone-500 text-xs">
              Select an artisan application from the queue to view documents and record verification
              decisions.
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
