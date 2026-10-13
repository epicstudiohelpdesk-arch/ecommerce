'use client';

import React, { useEffect, useState } from 'react';
import { Card, Badge, Button, Input, Textarea, LoadingSpinner, Alert } from '@repo/ui';
import { getShopProfile, updateShopProfile } from '../../lib/api';
import type { ShopProfileDto } from '@repo/api-contracts';

export default function ShopProfilePage() {
  const [profile, setProfile] = useState<ShopProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form fields
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [craftStory, setCraftStory] = useState('');
  const [isVacationMode, setIsVacationMode] = useState(false);
  const [vacationMessage, setVacationMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getShopProfile()
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          setShopName(data.shopName);
          setDescription(data.description || '');
          setCraftStory(data.craftStory || '');
          setIsVacationMode(data.isVacationMode);
          setVacationMessage(data.vacationMessage || '');
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      const updated = await updateShopProfile({
        shopName: shopName.trim(),
        description: description.trim() || undefined,
        craftStory: craftStory.trim() || undefined,
        isVacationMode,
        vacationMessage: isVacationMode && vacationMessage ? vacationMessage.trim() : undefined,
      });
      setProfile(updated);
      setStatusMessage({
        type: 'success',
        text: 'Shop profile and craft story saved successfully!',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to update shop profile. Please verify fields.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Verification Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
              Shop Profile & Story
            </h1>
            <Badge variant="success" size="sm" withDot>
              {profile?.status || 'ACTIVE'} ARTISAN
            </Badge>
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Share your craft philosophy, manage studio availability, and present your artisan
            storefront.
          </p>
        </div>

        {profile?.ratingAverage !== undefined && profile.ratingAverage > 0 && (
          <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs">
            <span className="text-amber-700 font-bold">★ {profile.ratingAverage.toFixed(2)}</span>
            <span className="text-stone-500">({profile.ratingCount} artisan reviews)</span>
          </div>
        )}
      </div>

      {statusMessage && (
        <Alert variant={statusMessage.type === 'success' ? 'info' : 'error'} className="text-xs">
          {statusMessage.text}
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Shop Identity Card */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-bold text-stone-900 font-serif">Studio Identity</h2>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">Shop / Studio Name</label>
            <Input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">
              Studio Tagline & Short Description
            </label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Studio pottery and earthy terracotta tableware hand-thrown in small batches."
            />
          </div>
        </Card>

        {/* The Artisan Craft Story */}
        <Card className="p-6 space-y-3 border-amber-200 bg-amber-50/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <h2 className="text-base font-bold text-stone-900 font-serif">
              Artisan Craft Story & Heritage
            </h2>
          </div>
          <p className="text-xs text-stone-600">
            Tell discerning buyers about your techniques, clay and glaze origins, natural dyes,
            traditional tools, and creative process. This narrative is featured prominently on your
            public artisan storefront.
          </p>
          <Textarea
            rows={5}
            value={craftStory}
            onChange={(e) => setCraftStory(e.target.value)}
            placeholder="Share where you learned your craft, the raw materials you source locally, and the care taken in each handmade piece..."
          />
        </Card>

        {/* Vacation Mode & Availability */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 font-serif">
                Vacation & Studio Availability
              </h2>
              <p className="text-xs text-stone-500">
                Temporarily pause new incoming customer orders while attending craft exhibitions or
                taking a workshop break.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsVacationMode(!isVacationMode)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isVacationMode ? 'bg-amber-600' : 'bg-stone-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isVacationMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {isVacationMode && (
            <div className="pt-3 border-t border-stone-100 space-y-2">
              <label className="text-xs font-semibold text-stone-700">
                Vacation Notice Message to Customers
              </label>
              <Input
                placeholder="e.g. Traveling for the Surajkund Craft Fair. Orders placed now will be crafted starting next Monday."
                value={vacationMessage}
                onChange={(e) => setVacationMessage(e.target.value)}
              />
              <span className="text-[11px] text-stone-400">
                This notice will appear on your shop and product pages during vacation mode.
              </span>
            </div>
          )}
        </Card>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving Changes...' : 'Save Profile Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
