'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Badge, Card } from '@repo/ui';

interface UploadedMediaItem {
  id: string;
  url: string;
  fileName: string;
  isPrimary: boolean;
  altText: string;
}

export default function NewProductListingPage() {
  const router = useRouter();

  // Basic Information
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('cat-1');
  const [productType, setProductType] = useState('READY_TO_SHIP');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  // Craft & Provenance
  const [materials, setMaterials] = useState<string[]>(['Natural Clay']);
  const [newMaterial, setNewMaterial] = useState('');
  const [techniques, setTechniques] = useState<string[]>(['Wheel Throwing']);
  const [newTechnique, setNewTechnique] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(0);
  const [careInstructions, setCareInstructions] = useState('');
  const [isFragile, setIsFragile] = useState(false);
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [customizationInstructions, setCustomizationInstructions] = useState('');

  // Variant & Inventory
  const [basePriceRupees, setBasePriceRupees] = useState('850');
  const [sku, setSku] = useState(`CRAFT-${Date.now().toString().slice(-6)}`);
  const [variantTitle, setVariantTitle] = useState('Standard');
  const [weightGrams, setWeightGrams] = useState(450);
  const [lengthMm, setLengthMm] = useState(120);
  const [widthMm, setWidthMm] = useState(120);
  const [heightMm, setHeightMm] = useState(150);
  const [initialStock, setInitialStock] = useState(10);

  // Photographs & Media
  const [mediaList, setMediaList] = useState<UploadedMediaItem[]>([
    {
      id: 'media-1',
      url: '/media/sample-pottery.jpg',
      fileName: 'clay-pot-hero.jpg',
      isPrimary: true,
      altText: 'Handmade clay pot front view',
    },
  ]);
  const [simulatedUploading, setSimulatedUploading] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addMaterial = () => {
    if (newMaterial.trim() && !materials.includes(newMaterial.trim())) {
      setMaterials([...materials, newMaterial.trim()]);
      setNewMaterial('');
    }
  };

  const removeMaterial = (m: string) => {
    setMaterials(materials.filter((item) => item !== m));
  };

  const addTechnique = () => {
    if (newTechnique.trim() && !techniques.includes(newTechnique.trim())) {
      setTechniques([...techniques, newTechnique.trim()]);
      setNewTechnique('');
    }
  };

  const removeTechnique = (t: string) => {
    setTechniques(techniques.filter((item) => item !== t));
  };

  const handleSimulatedUpload = () => {
    setSimulatedUploading(true);
    setTimeout(() => {
      const newMedia: UploadedMediaItem = {
        id: `media-${Date.now()}`,
        url: `/media/uploaded-${Date.now()}.jpg`,
        fileName: `artisan-photo-${mediaList.length + 1}.jpg`,
        isPrimary: mediaList.length === 0,
        altText: `Craft photo ${mediaList.length + 1}`,
      };
      setMediaList([...mediaList, newMedia]);
      setSimulatedUploading(false);
    }, 600);
  };

  const setPrimaryPhoto = (id: string) => {
    setMediaList(
      mediaList.map((m) => ({
        ...m,
        isPrimary: m.id === id,
      })),
    );
  };

  const removePhoto = (id: string) => {
    setMediaList(mediaList.filter((m) => m.id !== id));
  };

  const handleSubmit = (forReview = false) => {
    setErrorMsg(null);

    if (!title.trim() || title.length < 3) {
      setErrorMsg('Product title must be at least 3 characters long.');
      return;
    }

    if (!description.trim() || description.length < 10) {
      setErrorMsg('Detailed description must be at least 10 characters long.');
      return;
    }

    const price = parseFloat(basePriceRupees);
    if (isNaN(price) || price <= 0) {
      setErrorMsg('Valid retail price in ₹ is required.');
      return;
    }

    if (forReview && mediaList.length === 0) {
      setErrorMsg('At least one product photograph is required to submit for moderation.');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      router.push('/products');
    }, 800);
  };

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      {/* Breadcrumb & Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Link href="/products" className="text-sm text-stone-500 hover:text-stone-800">
            Products & Inventory
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-sm font-medium text-stone-800">New Handcrafted Listing</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 mt-2">
          Create Handcrafted Listing
        </h1>
        <p className="text-stone-600 mt-1">
          Provide authentic provenance details, pricing, packaging dimensions, and high-resolution
          photographs.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <div className="space-y-8">
        {/* Section 1: Basic Information */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4 pb-2 border-b border-stone-200">
            1. Listing Overview
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                Listing Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Hand-carved Sheesham Wood Spice Box with Glass Lid"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Craft Category *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800"
                >
                  <option value="cat-1">Pottery & Ceramics</option>
                  <option value="cat-2">Woodcrafts & Carvings</option>
                  <option value="cat-3">Handmade Jewellery</option>
                  <option value="cat-4">Textiles & Handloom</option>
                  <option value="cat-5">Paintings & Folk Art</option>
                  <option value="cat-6">Customised & Heritage Gifts</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Production Type *
                </label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800"
                >
                  <option value="READY_TO_SHIP">Ready to Ship (Finished Stock)</option>
                  <option value="ONE_OF_A_KIND">One of a Kind (Unique Art Piece)</option>
                  <option value="MADE_TO_ORDER">Made to Order (Crafted on Purchase)</option>
                  <option value="PERSONALIZED">Personalised (Custom Engraved/Painted)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                Short Description
              </label>
              <input
                type="text"
                placeholder="Brief 1-line highlight for search previews and cards"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                Detailed Artisan Story & Description *
              </label>
              <textarea
                rows={4}
                placeholder="Describe the artisan craft process, heritage origin, cultural significance, and finishes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800"
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Craft Provenance */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4 pb-2 border-b border-stone-200">
            2. Craft Provenance & Authenticity
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                Authentic Raw Materials
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {materials.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-medium"
                  >
                    {m}
                    <button
                      type="button"
                      onClick={() => removeMaterial(m)}
                      className="text-amber-700 hover:text-amber-950 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Sheesham Wood, River Clay, Brass"
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-stone-300 rounded-lg"
                />
                <Button variant="secondary" onClick={addMaterial} className="text-xs">
                  + Add Material
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                Artisan Techniques Applied
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {techniques.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 text-stone-800 border border-stone-200 rounded-full text-xs font-medium"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTechnique(t)}
                      className="text-stone-600 hover:text-stone-950 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Hand Chiseled, Wood Fired, Block Printed"
                  value={newTechnique}
                  onChange={(e) => setNewTechnique(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-stone-300 rounded-lg"
                />
                <Button variant="secondary" onClick={addTechnique} className="text-xs">
                  + Add Technique
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Production Lead Time (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
                <p className="text-xs text-stone-500 mt-1">
                  0 days for ready stock; days needed to craft for made-to-order.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Care Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hand wash only with mild soap, keep dry."
                  value={careInstructions}
                  onChange={(e) => setCareInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFragile}
                  onChange={(e) => setIsFragile(e.target.checked)}
                  className="rounded border-stone-300 text-amber-800 focus:ring-amber-800"
                />
                <span className="text-sm font-medium text-stone-800">
                  Fragile Item (Requires courier protective packaging)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCustomizable}
                  onChange={(e) => setIsCustomizable(e.target.checked)}
                  className="rounded border-stone-300 text-amber-800 focus:ring-amber-800"
                />
                <span className="text-sm font-medium text-stone-800">
                  Customisation / Personalisation Allowed
                </span>
              </label>
            </div>

            {isCustomizable && (
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Customisation Instructions for Buyer
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please provide names or date for custom laser engraving..."
                  value={customizationInstructions}
                  onChange={(e) => setCustomizationInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Section 3: Pricing, Variant & Shipping Dimensions */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4 pb-2 border-b border-stone-200">
            3. Pricing & Shipping Dimensions
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Retail Price (INR ₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-stone-500 font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={basePriceRupees}
                    onChange={(e) => setBasePriceRupees(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-stone-300 rounded-lg font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Variant Title *
                </label>
                <input
                  type="text"
                  value={variantTitle}
                  onChange={(e) => setVariantTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Authoritative SKU *
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono text-stone-800"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Initial Stock on Hand
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialStock}
                  onChange={(e) => setInitialStock(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-semibold text-stone-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Dead Weight (Grams) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Length (mm) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={lengthMm}
                  onChange={(e) => setLengthMm(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Width (mm) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={widthMm}
                  onChange={(e) => setWidthMm(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Height (mm) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={heightMm}
                  onChange={(e) => setHeightMm(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>
            </div>
            <p className="text-xs text-stone-500">
              * Dimensions and weight are used for automated courier volumetric shipping
              calculations.
            </p>
          </div>
        </Card>

        {/* Section 4: Photographs & Media */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-200">
            <div>
              <h2 className="text-lg font-bold text-stone-900">4. Handcrafted Photography</h2>
              <p className="text-xs text-stone-500">
                At least 1 authentic photograph is required before submitting for quality
                moderation.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleSimulatedUpload}
              disabled={simulatedUploading}
              className="text-xs"
            >
              {simulatedUploading ? 'Signing Upload Ticket...' : '+ Upload Photograph'}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {mediaList.map((media) => (
              <div
                key={media.id}
                className="relative rounded-lg border border-stone-200 overflow-hidden bg-stone-50 p-2 flex flex-col items-center"
              >
                <div className="w-full h-28 bg-stone-200 rounded flex items-center justify-center text-xs text-stone-500 font-medium">
                  [Preview: {media.fileName}]
                </div>
                <div className="w-full mt-2 flex items-center justify-between">
                  {media.isPrimary ? (
                    <Badge variant="default" className="text-[10px] bg-amber-800 text-white">
                      Primary
                    </Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPrimaryPhoto(media.id)}
                      className="text-[10px] text-amber-800 hover:underline font-semibold"
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(media.id)}
                    className="text-[10px] text-red-600 hover:underline font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {mediaList.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-stone-300 rounded-xl p-8 text-center text-stone-500">
                <p className="text-sm font-medium">No photographs attached yet.</p>
                <p className="text-xs text-stone-400 mt-1">
                  Upload clear photos showing the handcrafted details, artisan signatures, and
                  scale.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-stone-200">
          <Link href="/products">
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={submitting}>
            Save as Draft
          </Button>
          <Button variant="primary" onClick={() => handleSubmit(true)} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit for Moderation'}
          </Button>
        </div>
      </div>
    </main>
  );
}
