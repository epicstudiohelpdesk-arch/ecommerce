'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';
import {
  getAdminModerationQueue,
  getAdminProductForModeration,
  moderateProduct,
  type AdminModerationProductItem,
} from '../../lib/api';

interface ProductModerationDetail {
  id?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export default function AdminProductModerationPage() {
  const [items, setItems] = useState<AdminModerationProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<AdminModerationProductItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ProductModerationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reasonCode, setReasonCode] = useState('AUTHENTIC_HANDCRAFT');
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminModerationQueue({ limit: 50 });
      setItems(res.items);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleSelectItem = async (item: AdminModerationProductItem) => {
    setSelectedItem(item);
    setModeratorNotes('');
    setActionSuccess(null);
    try {
      setDetailLoading(true);
      const detail = await getAdminProductForModeration(item.id);
      setSelectedDetail(detail);
    } catch {
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDecision = async (action: 'APPROVE' | 'REJECT' | 'SUSPEND') => {
    if (!selectedItem) return;

    if (action === 'REJECT' && (!moderatorNotes || moderatorNotes.length < 5)) {
      alert('A detailed note of at least 5 characters is required when rejecting a listing.');
      return;
    }

    try {
      setSubmitting(true);
      setActionSuccess(null);

      await moderateProduct(selectedItem.id, action, moderatorNotes || undefined, reasonCode);

      setActionSuccess(
        action === 'APPROVE'
          ? `Listing "${selectedItem.title}" has been APPROVED and published to customer storefront.`
          : action === 'REJECT'
            ? `Listing "${selectedItem.title}" has been REJECTED. Notes dispatched to artisan.`
            : `Listing "${selectedItem.title}" has been SUSPENDED.`,
      );

      setModeratorNotes('');
      await loadQueue();
      setSelectedItem(null);
      setSelectedDetail(null);
    } catch (err: unknown) {
      alert(`Moderation decision failed: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (minor: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(minor / 100);
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
              Product Quality & Authenticity Moderation
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Review artisan craft techniques, materials disclosure, photograph standards, and
              reject factory-made or prohibited items.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadQueue()} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh Queue'}
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <Card className="bg-emerald-950/40 border-emerald-800 text-emerald-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>✓</span> Moderation Confirmed
          </div>
          <p className="text-sm mt-1">{actionSuccess}</p>
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

      {/* Main Split Queue Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Moderation Queue List */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-stone-900 border-stone-800 overflow-hidden">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                Pending Moderation Queue ({items.length})
              </h2>
              <span className="text-xs text-stone-400">Items awaiting quality clearance</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-stone-400 text-xs">
                Querying pending craft listings...
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center text-stone-500 text-xs">
                Zero listings currently pending review. Queue is clear!
              </div>
            ) : (
              <div className="divide-y divide-stone-800/80 max-h-[600px] overflow-y-auto">
                {items.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const primaryImg = item.images.find((im) => im.isPrimary) || item.images[0];
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className={`p-4 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-950/20 border-l-4 border-amber-500'
                          : 'hover:bg-stone-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded bg-stone-950 border border-stone-800 shrink-0 overflow-hidden flex items-center justify-center">
                          {primaryImg ? (
                            <img
                              src={primaryImg.url}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl">🏺</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm truncate">
                            {item.title}
                          </div>
                          <div className="text-xs text-stone-400 mt-0.5">
                            {item.shopName} &bull; {item.categoryName}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="text-amber-400 font-bold">
                              {formatPrice(item.basePriceMinor)}
                            </span>
                            <span className="text-stone-500">&bull;</span>
                            <span className="text-stone-400">
                              {item.productType.replace('_', ' ')}
                            </span>
                            {item.isFragile && (
                              <span className="text-rose-400 text-[10px] bg-rose-950 px-1.5 py-0.5 rounded border border-rose-900">
                                FRAGILE
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="warning" size="sm">
                            PENDING
                          </Badge>
                          <span className="text-[10px] text-stone-500 mt-1">
                            {new Date(item.submittedAt).toLocaleDateString()}
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

        {/* Right: Detailed Product Inspector & Decision Panel */}
        <div className="lg:col-span-5">
          {selectedItem ? (
            <Card className="bg-stone-900 border-stone-800 p-5 space-y-5 sticky top-20 text-white">
              <div className="border-b border-stone-800 pb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base line-clamp-1">{selectedItem.title}</h3>
                  <p className="text-xs text-stone-400">
                    By {selectedItem.shopName} ({selectedItem.sellerLegalName})
                  </p>
                </div>
                <Badge variant="warning" size="sm">
                  IN REVIEW
                </Badge>
              </div>

              {detailLoading ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  Loading craft details & photographs...
                </div>
              ) : (
                <>
                  {/* Photographs Gallery */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                      Listing Photographs ({selectedItem.images.length})
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedItem.images.map((img) => (
                        <div
                          key={img.id}
                          className="aspect-square bg-stone-950 rounded border border-stone-800 overflow-hidden"
                        >
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Craft Specifications */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-stone-800/60">
                      <span className="text-stone-400">Category:</span>
                      <span className="font-medium">{selectedItem.categoryName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/60">
                      <span className="text-stone-400">Price:</span>
                      <span className="font-medium text-amber-400">
                        {formatPrice(selectedItem.basePriceMinor)}
                      </span>
                    </div>
                    {selectedItem.materials && selectedItem.materials.length > 0 && (
                      <div className="flex justify-between py-1 border-b border-stone-800/60">
                        <span className="text-stone-400">Materials:</span>
                        <span className="font-medium text-right">
                          {selectedItem.materials.join(', ')}
                        </span>
                      </div>
                    )}
                    {selectedItem.techniques && selectedItem.techniques.length > 0 && (
                      <div className="flex justify-between py-1 border-b border-stone-800/60">
                        <span className="text-stone-400">Techniques:</span>
                        <span className="font-medium text-right">
                          {selectedItem.techniques.join(', ')}
                        </span>
                      </div>
                    )}
                    {selectedDetail?.description && (
                      <div className="pt-2">
                        <span className="text-stone-400 block mb-1">Description:</span>
                        <p className="text-stone-300 text-xs bg-stone-950 p-2 rounded border border-stone-800 max-h-24 overflow-y-auto">
                          {selectedDetail.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Decision Controls */}
                  <div className="pt-3 border-t border-stone-800 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Authenticity Rationale Code:
                      </label>
                      <select
                        value={reasonCode}
                        onChange={(e) => setReasonCode(e.target.value)}
                        className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="AUTHENTIC_HANDCRAFT">
                          Authentic Handcrafted Artisan Craft
                        </option>
                        <option value="PHOTOGRAPHY_APPROVED">
                          Studio Photography Standard Compliant
                        </option>
                        <option value="POLICY_VIOLATION">
                          Commercial / Factory Made Violation
                        </option>
                        <option value="MISLEADING_DESCRIPTION">
                          Inadequate Craft Technique Disclosure
                        </option>
                        <option value="UNSAFE_MATERIALS">
                          Prohibited / Restricted Material Flag
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Moderator Audit Feedback (Mandatory for rejection):
                      </label>
                      <textarea
                        rows={2}
                        value={moderatorNotes}
                        onChange={(e) => setModeratorNotes(e.target.value)}
                        placeholder="Provide feedback for the artisan..."
                        className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleDecision('APPROVE')}
                      >
                        Approve & Publish
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleDecision('REJECT')}
                      >
                        Reject Listing
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          ) : (
            <Card className="bg-stone-900 border-stone-800 p-8 text-center text-stone-500 text-xs">
              Select a craft listing from the pending queue to inspect photographs, materials, and
              take a moderation decision.
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
