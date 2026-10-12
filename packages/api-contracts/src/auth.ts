export type UserRole =
  | 'ANONYMOUS'
  | 'CUSTOMER'
  | 'SELLER_APPLICANT'
  | 'APPROVED_SELLER'
  | 'RESTRICTED_SELLER'
  | 'CUSTOMER_SUPPORT'
  | 'MARKETPLACE_MANAGER'
  | 'FINANCE_CONTROLLER'
  | 'TRUST_SAFETY'
  | 'READ_ONLY_ANALYST'
  | 'SUPER_ADMIN';

export const USER_ROLES: readonly UserRole[] = [
  'ANONYMOUS',
  'CUSTOMER',
  'SELLER_APPLICANT',
  'APPROVED_SELLER',
  'RESTRICTED_SELLER',
  'CUSTOMER_SUPPORT',
  'MARKETPLACE_MANAGER',
  'FINANCE_CONTROLLER',
  'TRUST_SAFETY',
  'READ_ONLY_ANALYST',
  'SUPER_ADMIN',
] as const;

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  sellerId?: string | null;
}

export interface RegisterResult {
  userId: string;
  email: string;
  requiresEmailVerification: boolean;
  verificationToken?: string; // only populated in development/test environment for automated tests
}

export interface LoginSuccessResult {
  requiresMfa: false;
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

export interface LoginMfaRequiredResult {
  requiresMfa: true;
  mfaTicket: string;
  message: string;
}

export type LoginResult = LoginSuccessResult | LoginMfaRequiredResult;

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
  recoveryCodes?: string[];
}

export interface JwtTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  sellerId?: string | null;
  sessionId?: string;
  type: 'access' | 'refresh' | 'verify_email' | 'password_reset' | 'mfa_ticket';
  iat?: number;
  exp?: number;
}
