export interface SellerOnboardingStatus {
  hasProfile: boolean;
  sellerId?: string;
  verificationStatus: 'DRAFT' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  profile?: {
    legalName: string;
    businessType: string;
    taxId?: string | null;
    rejectionReason?: string | null;
    submittedAt?: string | null;
    verifiedAt?: string | null;
  };
  shop?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    craftStory?: string | null;
    logoUrl?: string | null;
  };
  pickupAddress?: {
    contactName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  documents: Array<{
    id: string;
    documentType: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    reviewNotes?: string | null;
    createdAt: string;
  }>;
  missingFields: string[];
  canSubmit: boolean;
}

export interface SellerEligibility {
  sellerId: string;
  isEligibleToSell: boolean;
  canPublishProducts: boolean;
  canReceivePayouts: boolean;
  verificationStatus: string;
  reason?: string;
}

export interface PresignedDocumentUploadTicket {
  documentId: string;
  storagePath: string;
  presignedUploadUrl: string;
  expiresInSeconds: number;
}

export interface SellerApplicationDetail {
  sellerId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  legalName: string;
  businessType: string;
  taxId?: string | null;
  verificationStatus: string;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  termsAcceptedVersion?: string | null;
  termsAcceptedAt?: string | null;
  shop?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    craftStory?: string | null;
    logoUrl?: string | null;
  } | null;
  pickupAddress?: {
    contactName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  documents: Array<{
    id: string;
    documentType: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    status: string;
    reviewNotes?: string | null;
    downloadUrl: string;
    createdAt: string;
  }>;
}

export interface SellerApplicationSummary {
  sellerId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  legalName: string;
  businessType: string;
  shopName: string;
  shopSlug: string;
  verificationStatus: string;
  documentCount: number;
  submittedAt?: string | null;
  createdAt: string;
}
