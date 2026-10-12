'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';
import type { SellerOnboardingStatus } from '@repo/api-contracts';

const ONBOARDING_STEPS = [
  { id: 1, name: 'Artisan Profile', description: 'Legal and business identity' },
  { id: 2, name: 'Shop & Craft', description: 'Storefront details and craft story' },
  { id: 3, name: 'Pickup Address', description: 'Workshop location for courier pickup' },
  { id: 4, name: 'KYC & Credentials', description: 'Identity and craft proof documents' },
  { id: 5, name: 'Review & Submit', description: 'Terms agreement and final verification' },
];

export default function SellerOnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [status, setStatus] = useState<SellerOnboardingStatus>({
    hasProfile: false,
    verificationStatus: 'DRAFT',
    missingFields: [
      'legalName',
      'businessType',
      'shopName',
      'shopSlug',
      'craftDescription',
      'pickupAddress',
      'verificationDocuments',
    ],
    canSubmit: false,
    documents: [],
  });

  // Form State
  const [legalName, setLegalName] = useState('Meera Sharma');
  const [businessType, setBusinessType] = useState('INDIVIDUAL');
  const [taxId, setTaxId] = useState('GSTIN08AABCT1234F1Z5');
  const [shopName, setShopName] = useState('Terracotta Whispers');
  const [shopSlug, setShopSlug] = useState('terracotta-whispers');
  const [craftDescription, setCraftDescription] = useState(
    'Hand-molded traditional terracotta pottery and ceramic dinnerware crafted with clay from the riverbeds of Rajasthan.',
  );
  const [contactName, setContactName] = useState('Meera Sharma');
  const [phone, setPhone] = useState('+919876543210');
  const [addressLine1, setAddressLine1] = useState('Plot 42, Potter Colony, Shilpgram');
  const [addressLine2, setAddressLine2] = useState('Near Craft Center');
  const [city, setCity] = useState('Jaipur');
  const [state, setState] = useState('Rajasthan');
  const [postalCode, setPostalCode] = useState('302001');
  const [country] = useState('IN');
  const [selectedDocType, setSelectedDocType] = useState('ARTISAN_CERTIFICATE');
  const [uploadedDocs, setUploadedDocs] = useState<
    Array<{ id: string; name: string; type: string; size: string }>
  >([
    {
      id: 'doc-1',
      name: 'artisan_handicraft_card.pdf',
      type: 'ARTISAN_CERTIFICATE',
      size: '245 KB',
    },
  ]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  const handleAddMockDocument = () => {
    const newDoc = {
      id: `doc-${Date.now()}`,
      name: `${selectedDocType.toLowerCase()}_proof.pdf`,
      type: selectedDocType,
      size: '312 KB',
    };
    setUploadedDocs([...uploadedDocs, newDoc]);
  };

  const handleRemoveDocument = (id: string) => {
    setUploadedDocs(uploadedDocs.filter((d) => d.id !== id));
  };

  const handleSubmitApplication = () => {
    if (!termsAccepted) {
      alert('Please accept the Marketplace Artisan Terms & Quality Agreement before submitting.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setStatus({
        ...status,
        hasProfile: true,
        verificationStatus: 'PENDING_REVIEW',
        profile: {
          legalName,
          businessType,
          taxId,
          submittedAt: new Date().toISOString(),
        },
        shop: {
          id: 'shop-preview-id',
          name: shopName,
          slug: shopSlug,
          description: craftDescription,
          craftStory: craftDescription,
        },
        canSubmit: false,
        missingFields: [],
      });
      setIsSubmitting(false);
      setSubmitFeedback(
        'Application submitted successfully! Our curation and compliance team will review your application within 24-48 business hours.',
      );
    }, 600);
  };

  return (
    <main className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm font-medium text-amber-700 hover:text-amber-800 mb-2 inline-block"
        >
          ← Back to Studio Overview
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">
              Artisan Onboarding & Verification
            </h1>
            <p className="text-stone-600 mt-1">
              Complete your verification to unlock your independent shop, catalog publishing, and
              customer orders.
            </p>
          </div>
          <div>
            {status.verificationStatus === 'DRAFT' && (
              <Badge variant="default">Status: Draft</Badge>
            )}
            {status.verificationStatus === 'PENDING_REVIEW' && (
              <Badge variant="warning">Status: Under Review</Badge>
            )}
            {status.verificationStatus === 'VERIFIED' && (
              <Badge variant="success">Status: Approved Artisan</Badge>
            )}
            {status.verificationStatus === 'REJECTED' && (
              <Badge variant="destructive">Status: Changes Requested</Badge>
            )}
            {status.verificationStatus === 'SUSPENDED' && (
              <Badge variant="destructive">Status: Suspended</Badge>
            )}
          </div>
        </div>
      </div>

      {submitFeedback && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm">
          ✓ {submitFeedback}
        </div>
      )}

      {status.verificationStatus === 'PENDING_REVIEW' ? (
        <Card className="p-8 border-amber-200 bg-amber-50/50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xl">
              ⏳
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-stone-900">
                Application Under Compliance & Quality Review
              </h2>
              <p className="text-stone-700">
                Your artisan shop application for <strong>{shopName}</strong> has been received and
                is in the review queue. Our Trust & Safety curators verify the authenticity of all
                handmade items, artisan credentials, and workshop declarations before approving
                storefront publication.
              </p>
              <div className="pt-4 flex gap-4">
                <Button
                  variant="secondary"
                  onClick={() => setStatus({ ...status, verificationStatus: 'DRAFT' })}
                >
                  Edit Draft Details
                </Button>
                <Link href="/">
                  <Button variant="primary">Return to Hub</Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Stepper Navigation */}
          <aside className="md:col-span-1 space-y-2">
            {ONBOARDING_STEPS.map((step) => {
              const isActive = currentStep === step.id;
              const isPast = currentStep > step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-amber-50 border-amber-500 font-semibold text-amber-900 shadow-sm'
                      : isPast
                        ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        : 'bg-white border-stone-200 text-stone-400'
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Step {step.id}
                  </div>
                  <div className="text-sm font-medium mt-0.5">{step.name}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{step.description}</div>
                </button>
              );
            })}
          </aside>

          {/* Step Panels */}
          <div className="md:col-span-3">
            <Card className="p-6">
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-stone-900 border-b pb-3">
                    Artisan & Business Identity
                  </h2>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Legal Business / Artisan Name *
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Business Structure *
                    </label>
                    <select
                      className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                    >
                      <option value="INDIVIDUAL">Individual Independent Artisan</option>
                      <option value="SOLE_PROPRIETORSHIP">
                        Sole Proprietorship / Guild Member
                      </option>
                      <option value="REGISTERED_COMPANY">
                        Registered Craft Enterprise / Co-operative
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Tax ID / PAN / GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end pt-4 border-t">
                    <Button variant="primary" onClick={() => setCurrentStep(2)}>
                      Next: Shop & Craft →
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-stone-900 border-b pb-3">
                    Shop Identity & Craft Story
                  </h2>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Public Shop Name *
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={shopName}
                      onChange={(e) => {
                        setShopName(e.target.value);
                        setShopSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)/g, ''),
                        );
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Storefront URL Slug *
                    </label>
                    <div className="flex items-center">
                      <span className="text-sm text-stone-500 bg-stone-100 border border-r-0 border-stone-300 px-3 py-2 rounded-l-md">
                        marketplace.local/shops/
                      </span>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-r-md border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                        value={shopSlug}
                        onChange={(e) => setShopSlug(e.target.value)}
                      />
                    </div>
                    <span className="text-xs text-emerald-600 mt-1 block">
                      ✓ Available for registration
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Craft Story & Process Description *
                    </label>
                    <textarea
                      rows={4}
                      className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={craftDescription}
                      onChange={(e) => setCraftDescription(e.target.value)}
                    />
                    <span className="text-xs text-stone-500">
                      Explain your handmade materials, production methods, and artistic background.
                    </span>
                  </div>
                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                      ← Back
                    </Button>
                    <Button variant="primary" onClick={() => setCurrentStep(3)}>
                      Next: Pickup Address →
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-stone-900 border-b pb-3">
                    Workshop & Fulfillment Pickup Address
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        Contact Phone *
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Workshop Address Line 1 *
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        State *
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        Postal Code *
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        Country *
                      </label>
                      <input
                        type="text"
                        disabled
                        className="w-full px-3 py-2 border rounded-md border-stone-200 bg-stone-100 text-stone-700"
                        value={country}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setCurrentStep(2)}>
                      ← Back
                    </Button>
                    <Button variant="primary" onClick={() => setCurrentStep(4)}>
                      Next: KYC Documents →
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-stone-900 border-b pb-3">
                    Artisan Proof & Identity Verification
                  </h2>
                  <p className="text-sm text-stone-600">
                    To maintain the purity of the handcrafted marketplace, upload at least one
                    legitimate verification document (Government ID, Artisan/Craft Council Card, or
                    Business Registration). Maximum 10MB; accepted formats: PDF, PNG, JPG.
                  </p>

                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-stone-700 mb-1">
                          Document Category
                        </label>
                        <select
                          className="w-full px-3 py-2 border rounded-md border-stone-300 text-stone-900 text-sm"
                          value={selectedDocType}
                          onChange={(e) => setSelectedDocType(e.target.value)}
                        >
                          <option value="ARTISAN_CERTIFICATE">Artisan / Guild Certificate</option>
                          <option value="GOVERNMENT_ID">Government Photo Identification</option>
                          <option value="TAX_CERTIFICATE">Tax / Business Registration Proof</option>
                          <option value="BANK_PROOF">Bank Account Settlement Proof</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button variant="secondary" onClick={handleAddMockDocument}>
                          + Attach Verification File
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-stone-800 mb-2">
                      Attached Verification Documents
                    </h3>
                    {uploadedDocs.length === 0 ? (
                      <div className="p-6 border-2 border-dashed border-stone-300 rounded-lg text-center text-stone-500 text-sm">
                        No verification documents attached yet. Please attach at least 1 document to
                        qualify for review.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {uploadedDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-white"
                          >
                            <div>
                              <div className="font-medium text-stone-900 text-sm">{doc.name}</div>
                              <div className="text-xs text-stone-500">
                                {doc.type} • {doc.size} • Private & Secure
                              </div>
                            </div>
                            <Button variant="ghost" onClick={() => handleRemoveDocument(doc.id)}>
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setCurrentStep(3)}>
                      ← Back
                    </Button>
                    <Button
                      variant="primary"
                      disabled={uploadedDocs.length === 0}
                      onClick={() => setCurrentStep(5)}
                    >
                      Next: Review & Submit →
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-stone-900 border-b pb-3">
                    Review & Submit Application
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-stone-50 p-4 rounded-lg">
                    <div>
                      <div className="text-stone-500 text-xs uppercase font-semibold">
                        Legal Artisan Name
                      </div>
                      <div className="text-stone-900 font-medium">{legalName}</div>
                    </div>
                    <div>
                      <div className="text-stone-500 text-xs uppercase font-semibold">
                        Storefront Slug
                      </div>
                      <div className="text-stone-900 font-medium">
                        {shopName} ({shopSlug})
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500 text-xs uppercase font-semibold">
                        Pickup Location
                      </div>
                      <div className="text-stone-900 font-medium">
                        {city}, {state} ({postalCode})
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500 text-xs uppercase font-semibold">
                        Attached Credentials
                      </div>
                      <div className="text-stone-900 font-medium">
                        {uploadedDocs.length} Verification Document(s)
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-amber-50/60 border-amber-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                      />
                      <span className="text-xs text-stone-800 leading-relaxed">
                        I hereby declare and warrant that all products offered through this
                        storefront are genuine handcrafted, artisan-made, or small-batch creations
                        in compliance with marketplace authenticity guidelines. I accept the
                        Handcrafted Marketplace Artisan Agreement (Version v1.0-2026).
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setCurrentStep(4)}>
                      ← Back
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!termsAccepted || isSubmitting}
                      onClick={handleSubmitApplication}
                    >
                      {isSubmitting ? 'Submitting Application...' : 'Submit Application for Review'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
