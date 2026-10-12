'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';
import type { ProductSummaryDto } from '@repo/api-contracts';
import type { StockAdjustmentReason } from '@repo/validation';

const MOCK_SELLER_PRODUCTS: ProductSummaryDto[] = [
  {
    id: 'prod-001',
    sellerId: 'sel-1001',
    title: 'Hand-thrown Terracotta Chai Cups (Set of 6)',
    slug: 'hand-thrown-terracotta-chai-cups-set-of-6',
    productType: 'READY_TO_SHIP',
    basePriceMinor: 89000,
    currency: 'INR',
    category: {
      id: 'cat-1',
      name: 'Pottery & Ceramics',
      slug: 'pottery-ceramics',
    },
    primaryImageUrl: '/media/terracotta-cups.jpg',
    moderationStatus: 'PUBLISHED',
    isActive: true,
    totalStock: 35,
    createdAt: '2026-10-10T10:00:00.000Z',
    publishedAt: '2026-10-11T12:00:00.000Z',
  },
  {
    id: 'prod-002',
    sellerId: 'sel-1001',
    title: 'Glazed Stoneware Serving Bowl - Cobalt Blue',
    slug: 'glazed-stoneware-serving-bowl-cobalt-blue',
    productType: 'ONE_OF_A_KIND',
    basePriceMinor: 175000,
    currency: 'INR',
    category: {
      id: 'cat-1',
      name: 'Pottery & Ceramics',
      slug: 'pottery-ceramics',
    },
    primaryImageUrl: '/media/stoneware-bowl.jpg',
    moderationStatus: 'PENDING_REVIEW',
    isActive: true,
    totalStock: 8,
    createdAt: '2026-10-12T08:30:00.000Z',
  },
  {
    id: 'prod-003',
    sellerId: 'sel-1001',
    title: 'Rustic Earthen Planter Pot with Hand-carved Motifs',
    slug: 'rustic-earthen-planter-pot',
    productType: 'MADE_TO_ORDER',
    basePriceMinor: 120000,
    currency: 'INR',
    category: {
      id: 'cat-1',
      name: 'Pottery & Ceramics',
      slug: 'pottery-ceramics',
    },
    primaryImageUrl: null,
    moderationStatus: 'DRAFT',
    isActive: true,
    totalStock: 0,
    createdAt: '2026-10-12T10:15:00.000Z',
  },
  {
    id: 'prod-004',
    sellerId: 'sel-1001',
    title: 'Miniature Terracotta Diya Lamps (Pack of 12)',
    slug: 'miniature-terracotta-diya-lamps-pack-of-12',
    productType: 'READY_TO_SHIP',
    basePriceMinor: 45000,
    currency: 'INR',
    category: {
      id: 'cat-1',
      name: 'Pottery & Ceramics',
      slug: 'pottery-ceramics',
    },
    primaryImageUrl: '/media/diyas.jpg',
    moderationStatus: 'REJECTED',
    isActive: false,
    totalStock: 50,
    createdAt: '2026-10-09T14:20:00.000Z',
  },
];

export default function SellerProductsPage() {
  const [products, setProducts] = useState<ProductSummaryDto[]>(MOCK_SELLER_PRODUCTS);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [adjustModalProduct, setAdjustModalProduct] = useState<ProductSummaryDto | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(5);
  const [adjustReason, setAdjustReason] = useState<StockAdjustmentReason>('RECEIPT');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filteredProducts = products.filter((prod) => {
    if (statusFilter !== 'ALL' && prod.moderationStatus !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return prod.title.toLowerCase().includes(q) || prod.category.name.toLowerCase().includes(q);
    }
    return true;
  });

  const handleStockAdjustment = () => {
    if (!adjustModalProduct) return;

    const newStock = adjustModalProduct.totalStock + adjustDelta;
    if (newStock < 0) {
      alert('Adjustment would result in negative stock!');
      return;
    }

    setProducts((prev) =>
      prev.map((p) => (p.id === adjustModalProduct.id ? { ...p, totalStock: newStock } : p)),
    );

    setActionSuccess(
      `Inventory for "${adjustModalProduct.title}" adjusted by ${adjustDelta > 0 ? `+${adjustDelta}` : adjustDelta} units (New on-hand: ${newStock}).`,
    );
    setAdjustModalProduct(null);
    setAdjustNotes('');
  };

  const handleArchive = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, moderationStatus: 'ARCHIVED', isActive: false } : p,
      ),
    );
    setActionSuccess('Product listing successfully archived and hidden from public search.');
  };

  const handleSubmitForReview = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, moderationStatus: 'PENDING_REVIEW' } : p)),
    );
    setActionSuccess('Product submitted for compliance review and authenticity moderation.');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="success">Published</Badge>;
      case 'PENDING_REVIEW':
        return <Badge variant="warning">Pending Review</Badge>;
      case 'DRAFT':
        return <Badge variant="default">Draft</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'ARCHIVED':
        return <Badge variant="default">Archived</Badge>;
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
            <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
              Studio Hub
            </Link>
            <span className="text-stone-400">/</span>
            <span className="text-sm font-medium text-stone-800">Products & Inventory</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 mt-1">
            Artisan Product Catalogue
          </h1>
          <p className="text-stone-600 mt-1">
            Maintain your handcrafted listings, photography, craft specifications, and live
            inventory.
          </p>
        </div>
        <Link href="/products/new">
          <Button variant="primary" className="whitespace-nowrap">
            + Create New Listing
          </Button>
        </Link>
      </div>

      {actionSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between">
          <p className="text-sm font-medium">{actionSuccess}</p>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 text-sm font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="mb-8 p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {['ALL', 'PUBLISHED', 'PENDING_REVIEW', 'DRAFT', 'REJECTED', 'ARCHIVED'].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    statusFilter === status
                      ? 'bg-amber-800 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {status === 'ALL' ? 'All Listings' : status.replace('_', ' ')}
                </button>
              ),
            )}
          </div>
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search by title or craft..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800"
            />
          </div>
        </div>
      </Card>

      {/* Listings Table */}
      <Card className="p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-600">
            <thead className="bg-stone-50 border-b border-stone-200 text-xs font-semibold uppercase text-stone-500">
              <tr>
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4">Craft Type</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Inventory</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                    No products found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0 text-stone-400 text-xs">
                          {product.primaryImageUrl ? (
                            <span className="font-medium text-amber-800">Photo</span>
                          ) : (
                            <span>No Pic</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-stone-900">{product.title}</p>
                          <p className="text-xs text-stone-500 mt-0.5">{product.category.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-stone-100 text-stone-700 px-2.5 py-1 rounded-md font-mono">
                        {product.productType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-stone-900">
                      ₹
                      {(product.basePriceMinor / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            product.totalStock === 0
                              ? 'text-red-600'
                              : product.totalStock < 10
                                ? 'text-amber-600'
                                : 'text-stone-900'
                          }`}
                        >
                          {product.totalStock} units
                        </span>
                        <button
                          onClick={() => {
                            setAdjustModalProduct(product);
                            setAdjustDelta(5);
                          }}
                          className="text-xs text-amber-800 hover:underline font-medium"
                        >
                          Adjust
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(product.moderationStatus)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {product.moderationStatus === 'DRAFT' && (
                          <Button
                            variant="primary"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => handleSubmitForReview(product.id)}
                          >
                            Submit
                          </Button>
                        )}
                        {product.moderationStatus !== 'ARCHIVED' && (
                          <Button
                            variant="secondary"
                            className="px-2.5 py-1 text-xs border border-stone-300"
                            onClick={() => handleArchive(product.id)}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Stock Adjustment Modal */}
      {adjustModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-stone-900 mb-1">Adjust On-Hand Stock</h2>
            <p className="text-xs text-stone-500 mb-4 truncate">{adjustModalProduct.title}</p>

            <div className="space-y-4">
              <div className="p-3 bg-stone-50 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Current Stock:</span>
                  <span className="font-semibold text-stone-900">
                    {adjustModalProduct.totalStock} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Adjustment Delta:</span>
                  <span className="font-semibold text-amber-800">
                    {adjustDelta > 0 ? `+${adjustDelta}` : adjustDelta} units
                  </span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-1">
                  <span className="text-stone-700 font-medium">New Stock on Hand:</span>
                  <span className="font-bold text-stone-900">
                    {adjustModalProduct.totalStock + adjustDelta} units
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Quantity Delta (Positive or Negative)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((d) => d - 1)}
                    className="w-9 h-9 border border-stone-300 rounded-lg font-bold hover:bg-stone-100 flex items-center justify-center text-stone-700"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                    className="flex-1 text-center py-1.5 border border-stone-300 rounded-lg font-semibold text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((d) => d + 1)}
                    className="w-9 h-9 border border-stone-300 rounded-lg font-bold hover:bg-stone-100 flex items-center justify-center text-stone-700"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Adjustment Reason
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as StockAdjustmentReason)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800"
                >
                  <option value="RECEIPT">New Batch Receipt / Kiln Fired</option>
                  <option value="MANUAL_CORRECTION">Manual Stock Audit Correction</option>
                  <option value="BREAKAGE">Breakage / Workshop Damage</option>
                  <option value="RETURN_RESTOCK">Customer Return Restock</option>
                  <option value="AUDIT_DISCREPANCY">Discrepancy Investigation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Audit Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Unloaded 10 pieces from wood-fired kiln."
                  className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="w-1/2"
                  onClick={() => setAdjustModalProduct(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="w-1/2"
                  onClick={handleStockAdjustment}
                  disabled={adjustDelta === 0}
                >
                  Commit Adjustment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
