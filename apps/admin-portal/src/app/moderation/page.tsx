'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';

interface ModerationItem {
  id: string;
  sellerId: string;
  sellerName: string;
  shopName: string;
  title: string;
  slug: string;
  category: {
    id: string;
    name: string;
  };
  productType: string;
  basePriceMinor: number;
  totalStock: number;
  submittedAt: string;
  moderationStatus: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'SUSPENDED';
  rejectionReason?: string | null;
  materials: string[];
  techniques: string[];
  description: string;
  isFragile: boolean;
  dimensions: {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    weightGrams: number;
  };
  sku: string;
  mediaUrls: string[];
}

const MOCK_MODERATION_ITEMS: ModerationItem[] = [
  {
    id: 'prod-mod-101',
    sellerId: 'sel-1001',
    sellerName: 'Meera Sharma',
    shopName: 'Terracotta Whispers',
    title: 'Glazed Stoneware Serving Bowl - Cobalt Blue',
    slug: 'glazed-stoneware-serving-bowl-cobalt-blue',
    category: {
      id: 'cat-1',
      name: 'Pottery & Ceramics',
    },
    productType: 'ONE_OF_A_KIND',
    basePriceMinor: 175000,
    totalStock: 8,
    submittedAt: '2026-10-12T08:30:00.000Z',
    moderationStatus: 'PENDING_REVIEW',
    materials: ['High-fire Stoneware Clay', 'Cobalt Oxide Mineral Glaze'],
    techniques: ['Potter Wheel Throwing', '1250°C Reduction Firing'],
    description:
      'Hand-thrown cobalt blue serving bowl. Fired at over 1250°C for exceptional durability. Each piece bears individual glaze drip characteristics that cannot be reproduced in factory casting.',
    isFragile: true,
    dimensions: {
      lengthMm: 240,
      widthMm: 240,
      heightMm: 95,
      weightGrams: 1250,
    },
    sku: 'STONE-BOWL-BL-01',
    mediaUrls: ['/media/stoneware-bowl-1.jpg', '/media/stoneware-bowl-bottom.jpg'],
  },
  {
    id: 'prod-mod-102',
    sellerId: 'sel-1002',
    sellerName: 'Karan Verma',
    shopName: 'Teak & Chisel',
    title: 'Hand-carved Teakwood Decorative Elephant Figurine',
    slug: 'hand-carved-teakwood-elephant',
    category: {
      id: 'cat-2',
      name: 'Woodcrafts & Carvings',
    },
    productType: 'READY_TO_SHIP',
    basePriceMinor: 240000,
    totalStock: 12,
    submittedAt: '2026-10-12T09:15:00.000Z',
    moderationStatus: 'PENDING_REVIEW',
    materials: ['Reclaimed CP Teak Wood', 'Natural Beeswax Polish'],
    techniques: ['Relief Chisel Carving', 'Hand Buffing'],
    description:
      'Traditional heritage elephant sculpture handcrafted from single seasoned block of reclaimed teak. Finished exclusively with organic beeswax, preserving authentic wood grain aromatics.',
    isFragile: false,
    dimensions: {
      lengthMm: 180,
      widthMm: 90,
      heightMm: 150,
      weightGrams: 850,
    },
    sku: 'TEAK-ELEPH-09',
    mediaUrls: ['/media/teak-elephant.jpg'],
  },
  {
    id: 'prod-mod-103',
    sellerId: 'sel-1003',
    sellerName: 'Anjali Devi',
    shopName: 'Varanasi Silks & Loom',
    title: 'Handloom Katan Silk Stole with Zari Border',
    slug: 'handloom-katan-silk-stole',
    category: {
      id: 'cat-4',
      name: 'Textiles & Handloom',
    },
    productType: 'READY_TO_SHIP',
    basePriceMinor: 380000,
    totalStock: 5,
    submittedAt: '2026-10-11T14:20:00.000Z',
    moderationStatus: 'PUBLISHED',
    materials: ['Pure Mulberry Silk', 'Silver-dipped Zari Thread'],
    techniques: ['Pit Loom Weaving', 'Kadwa Brocade'],
    description:
      'Authentic Banarasi pit loom woven stole crafted by master weavers. Verified Silk Mark compliant.',
    isFragile: false,
    dimensions: {
      lengthMm: 2000,
      widthMm: 600,
      heightMm: 5,
      weightGrams: 220,
    },
    sku: 'SILK-STOLE-004',
    mediaUrls: ['/media/silk-stole.jpg'],
  },
];

export default function AdminProductModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>(MOCK_MODERATION_ITEMS);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_REVIEW');
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [reasonCode, setReasonCode] = useState('AUTHENTIC_HANDCRAFT');
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (statusFilter === 'ALL') return true;
    return item.moderationStatus === statusFilter;
  });

  const handleDecision = (decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => {
    if (!selectedItem) return;

    if ((decision === 'REJECTED' || decision === 'SUSPENDED') && moderatorNotes.trim().length < 5) {
      alert(
        'A detailed note of at least 5 characters is mandatory when rejecting or suspending a listing.',
      );
      return;
    }

    const newStatus =
      decision === 'APPROVED' ? 'PUBLISHED' : decision === 'REJECTED' ? 'REJECTED' : 'SUSPENDED';

    setItems((prev) =>
      prev.map((i) =>
        i.id === selectedItem.id
          ? {
              ...i,
              moderationStatus: newStatus,
              rejectionReason: decision === 'APPROVED' ? null : moderatorNotes,
            }
          : i,
      ),
    );

    setActionSuccess(
      `Listing "${selectedItem.title}" has been successfully marked as ${newStatus}. Immutable audit log created.`,
    );
    setSelectedItem(null);
    setModeratorNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="success">Published</Badge>;
      case 'PENDING_REVIEW':
        return <Badge variant="warning">Pending Review</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <main className="max-w-6xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-stone-400 hover:text-white">
              Platform Governance
            </Link>
            <span className="text-stone-500">/</span>
            <span className="text-sm font-medium text-amber-500">Product Moderation</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-1">
            Product Listing Compliance Queue
          </h1>
          <p className="text-stone-400 mt-1">
            Enforce handcrafted authenticity standards, prevent mass-produced factory resale, and
            audit seller listings.
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-6 p-4 bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 rounded-lg flex items-center justify-between">
          <p className="text-sm font-medium">{actionSuccess}</p>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-100 text-sm font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-stone-800 pb-3">
        {['PENDING_REVIEW', 'ALL', 'PUBLISHED', 'REJECTED', 'SUSPENDED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === tab
                ? 'bg-amber-600 text-white'
                : 'bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table of Listings */}
      <Card className="p-0 overflow-hidden bg-stone-900 border-stone-800 text-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-950 border-b border-stone-800 text-xs font-semibold uppercase text-stone-400">
              <tr>
                <th className="px-6 py-4">Listing & Artisan</th>
                <th className="px-6 py-4">Craft Type</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                    No product listings found in this moderation queue filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          Shop: <span className="text-amber-400 font-medium">{item.shopName}</span>{' '}
                          ({item.sellerName})
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-stone-800 text-stone-300 px-2 py-0.5 rounded font-mono">
                        {item.category.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      ₹
                      {(item.basePriceMinor / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 font-medium">{item.totalStock} units</td>
                    <td className="px-6 py-4 text-xs text-stone-400">
                      {new Date(item.submittedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(item.moderationStatus)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="primary"
                        className="px-3 py-1 text-xs"
                        onClick={() => setSelectedItem(item)}
                      >
                        Inspect & Review
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Drawer / Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl text-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
              <div>
                <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                  Compliance Audit
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">{selectedItem.title}</h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-stone-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Segregation of Duties Notice */}
            <div className="mb-4 p-3 bg-amber-950/50 border border-amber-600/40 rounded-lg text-xs text-amber-300">
              <span className="font-semibold">Segregation of Duties Enforcement:</span> Platform
              moderators are strictly barred from reviewing listings from their own registered
              seller account.
            </div>

            {/* Listing Details */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-stone-950 p-3 rounded-lg border border-stone-800">
                <div>
                  <span className="text-stone-500">Artisan / Shop:</span>
                  <p className="font-medium text-white">
                    {selectedItem.shopName} ({selectedItem.sellerName})
                  </p>
                </div>
                <div>
                  <span className="text-stone-500">Category & Type:</span>
                  <p className="font-medium text-white">
                    {selectedItem.category.name} • {selectedItem.productType}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500">Price & SKU:</span>
                  <p className="font-medium text-white">
                    ₹{(selectedItem.basePriceMinor / 100).toFixed(2)} • {selectedItem.sku}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500">Packaging Specs:</span>
                  <p className="font-medium text-white">
                    {selectedItem.dimensions.lengthMm}×{selectedItem.dimensions.widthMm}×
                    {selectedItem.dimensions.heightMm}mm ({selectedItem.dimensions.weightGrams}g)
                  </p>
                </div>
              </div>

              <div>
                <span className="text-stone-400 font-semibold">Artisan Description:</span>
                <p className="mt-1 text-stone-300 leading-relaxed bg-stone-950/50 p-2.5 rounded border border-stone-800">
                  {selectedItem.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-stone-400 font-semibold">Raw Materials:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedItem.materials.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded text-[11px]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-stone-400 font-semibold">Artisan Techniques:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedItem.techniques.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded text-[11px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Photographs Gallery */}
              <div>
                <span className="text-stone-400 font-semibold">
                  Product Photographs ({selectedItem.mediaUrls.length}):
                </span>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  {selectedItem.mediaUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="h-24 bg-stone-800 rounded flex items-center justify-center border border-stone-700 text-stone-400 text-xs"
                    >
                      [Photo Preview #{idx + 1}]
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Form */}
              <div className="pt-4 border-t border-stone-800 space-y-3">
                <span className="text-stone-200 font-bold text-sm block">
                  Record Moderation Decision
                </span>

                <div>
                  <label className="block text-stone-400 mb-1">Reason Code</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full px-3 py-1.5 bg-stone-800 border border-stone-700 rounded text-xs text-white"
                  >
                    <option value="AUTHENTIC_HANDCRAFT">
                      Authentic Handcrafted Verification (PASS)
                    </option>
                    <option value="QUALITY_VERIFIED">
                      Quality & Safety Standards Verified (PASS)
                    </option>
                    <option value="INSUFFICIENT_PROVENANCE">
                      Insufficient Handcrafted Provenance / Factory Resale
                    </option>
                    <option value="POLICY_VIOLATION">
                      Prohibited Commercial Goods Policy Breach
                    </option>
                    <option value="MISSING_SPECS">
                      Inaccurate Dimensions / Incomplete Specifications
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-400 mb-1">
                    Moderator Notes (Required for rejection/suspension)
                  </label>
                  <textarea
                    rows={2}
                    value={moderatorNotes}
                    onChange={(e) => setModeratorNotes(e.target.value)}
                    placeholder="Provide specific, actionable feedback for the artisan..."
                    className="w-full px-3 py-1.5 bg-stone-800 border border-stone-700 rounded text-xs text-white"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="primary"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => handleDecision('APPROVED')}
                  >
                    Approve & Publish Listing
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 bg-rose-700 hover:bg-rose-600 text-white"
                    onClick={() => handleDecision('REJECTED')}
                  >
                    Reject with Feedback
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300"
                    onClick={() => handleDecision('SUSPENDED')}
                  >
                    Suspend
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
