'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, Input, Modal, Select } from '@repo/ui';

interface InventoryItemView {
  id: string;
  sku: string;
  productTitle: string;
  variantName: string;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
  lowStockThreshold: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

const INITIAL_INVENTORY: InventoryItemView[] = [
  {
    id: 'inv-1',
    sku: 'POT-CHAI-SET6',
    productTitle: 'Hand-thrown Terracotta Chai Cups (Set of 6)',
    variantName: 'Rustic Matte',
    quantityOnHand: 11,
    quantityReserved: 3,
    available: 8,
    lowStockThreshold: 10,
    status: 'LOW_STOCK',
  },
  {
    id: 'inv-2',
    sku: 'POT-BOWL-BLU-LG',
    productTitle: 'Glazed Stoneware Serving Bowl - Cobalt Blue',
    variantName: 'Large (10 inch)',
    quantityOnHand: 8,
    quantityReserved: 1,
    available: 7,
    lowStockThreshold: 3,
    status: 'IN_STOCK',
  },
  {
    id: 'inv-3',
    sku: 'POT-PLTR-MED',
    productTitle: 'Rustic Earthen Planter Pot with Hand-carved Motifs',
    variantName: 'Medium Terracotta',
    quantityOnHand: 4,
    quantityReserved: 2,
    available: 2,
    lowStockThreshold: 5,
    status: 'LOW_STOCK',
  },
  {
    id: 'inv-4',
    sku: 'POT-VASE-EARTH',
    productTitle: 'Wheel-thrown Minimalist Clay Vase',
    variantName: 'Earth Charcoal (8 inch)',
    quantityOnHand: 0,
    quantityReserved: 0,
    available: 0,
    lowStockThreshold: 4,
    status: 'OUT_OF_STOCK',
  },
  {
    id: 'inv-5',
    sku: 'POT-CANDLE-TERRA',
    productTitle: 'Aromatherapy Soy Wax Candle in Terracotta Pot',
    variantName: 'Sandalwood & Jasmine',
    quantityOnHand: 25,
    quantityReserved: 2,
    available: 23,
    lowStockThreshold: 10,
    status: 'IN_STOCK',
  },
];

export default function SellerInventoryPage() {
  const [items, setItems] = useState<InventoryItemView[]>(INITIAL_INVENTORY);
  const [filter, setFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [search, setSearch] = useState('');

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemView | null>(null);
  const [adjustQty, setAdjustQty] = useState('5');
  const [adjustReason, setAdjustReason] = useState('RESTOCK');

  const filteredItems = items.filter((item) => {
    if (filter === 'LOW_STOCK' && item.status !== 'LOW_STOCK') return false;
    if (filter === 'OUT_OF_STOCK' && item.status !== 'OUT_OF_STOCK') return false;
    if (search) {
      const term = search.toLowerCase();
      return (
        item.productTitle.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        item.variantName.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const handleOpenAdjust = (item: InventoryItemView) => {
    setSelectedItem(item);
    setAdjustQty('5');
    setAdjustModalOpen(true);
  };

  const handleSaveAdjust = () => {
    if (!selectedItem) return;
    const diff = parseInt(adjustQty, 10);
    if (isNaN(diff)) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== selectedItem.id) return it;
        const newOnHand = Math.max(0, it.quantityOnHand + diff);
        const newAvailable = Math.max(0, newOnHand - it.quantityReserved);
        let newStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
        if (newAvailable <= 0) newStatus = 'OUT_OF_STOCK';
        else if (newAvailable <= it.lowStockThreshold) newStatus = 'LOW_STOCK';

        return {
          ...it,
          quantityOnHand: newOnHand,
          available: newAvailable,
          status: newStatus,
        };
      }),
    );
    setAdjustModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
            Inventory & Stock Reserves
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Maintain accurate stock levels for handmade goods to prevent overselling.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="outline" size="sm">
              Manage Products
            </Button>
          </Link>
          <Link href="/products/new">
            <Button variant="primary" size="sm">
              + New Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['ALL', 'LOW_STOCK', 'OUT_OF_STOCK'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filter === f
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {f === 'ALL' ? 'All Stock' : f === 'LOW_STOCK' ? '⚠️ Low Stock' : '🚫 Out of Stock'}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search SKU or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-3 px-4">Handcrafted Item & SKU</th>
                <th className="py-3 px-4">Variant</th>
                <th className="py-3 px-4 text-center">On-Hand</th>
                <th className="py-3 px-4 text-center">Reserved in Orders</th>
                <th className="py-3 px-4 text-center">Available Stock</th>
                <th className="py-3 px-4 text-center">Stock Status</th>
                <th className="py-3 px-4 text-right">Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-stone-900">{item.productTitle}</span>
                    <span className="block font-mono text-[11px] text-stone-400">{item.sku}</span>
                  </td>
                  <td className="py-3.5 px-4 text-stone-600 font-medium">{item.variantName}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-stone-800">
                    {item.quantityOnHand}
                  </td>
                  <td className="py-3.5 px-4 text-center text-amber-800 font-medium">
                    {item.quantityReserved}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`font-bold px-2.5 py-1 rounded-md ${
                        item.available <= 0
                          ? 'bg-rose-100 text-rose-800'
                          : item.available <= item.lowStockThreshold
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.available}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {item.status === 'OUT_OF_STOCK' && (
                      <Badge variant="destructive" size="sm">
                        Out of Stock
                      </Badge>
                    )}
                    {item.status === 'LOW_STOCK' && (
                      <Badge variant="warning" size="sm">
                        Low Stock (≤{item.lowStockThreshold})
                      </Badge>
                    )}
                    {item.status === 'IN_STOCK' && (
                      <Badge variant="success" size="sm">
                        In Stock
                      </Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleOpenAdjust(item)}>
                      Adjust Qty
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Adjust Modal */}
      {adjustModalOpen && selectedItem && (
        <Modal
          isOpen={adjustModalOpen}
          onClose={() => setAdjustModalOpen(false)}
          title={`Adjust Stock for ${selectedItem.sku}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Update on-hand count for <strong>{selectedItem.productTitle}</strong> (
              {selectedItem.variantName}).
            </p>
            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Quantity Adjustment (±)</label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
              <span className="text-[11px] text-stone-400">
                Use positive number to add kiln-fired stock (e.g. +5), or negative to subtract (e.g.
                -2).
              </span>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-stone-700">Reason</label>
              <Select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}>
                <option value="RESTOCK">Studio Kiln / Batch Restock</option>
                <option value="CYCLE_COUNT">Studio Physical Count Correction</option>
                <option value="DAMAGED">Damaged in Studio</option>
                <option value="PROMOTION">Reserved for Artisan Exhibition</option>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setAdjustModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveAdjust}>
                Save Adjustment
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
