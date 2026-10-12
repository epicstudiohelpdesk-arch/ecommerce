import { z } from 'zod';
import { emailSchema } from './common.js';

export const passwordSchema = z
  .string()
  .min(12, { message: 'Password must be at least 12 characters long' })
  .max(128, { message: 'Password cannot exceed 128 characters' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' })
  .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters long' })
    .max(100, { message: 'Full name cannot exceed 100 characters' }),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must follow E.164 format' })
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Password is required' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(10, { message: 'Verification token is required' }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10, { message: 'Password reset token is required' }),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const mfaChallengeSchema = z.object({
  mfaTicket: z.string().min(10, { message: 'MFA ticket is required' }),
  code: z
    .string()
    .length(6, { message: 'MFA code must be exactly 6 digits' })
    .regex(/^\d{6}$/, { message: 'MFA code must consist of digits only' }),
});

export type MfaChallengeInput = z.infer<typeof mfaChallengeSchema>;

export const mfaVerifySchema = z.object({
  secret: z.string().min(16, { message: 'MFA secret is required' }),
  code: z
    .string()
    .length(6, { message: 'MFA code must be exactly 6 digits' })
    .regex(/^\d{6}$/, { message: 'MFA code must consist of digits only' }),
});

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, { message: 'Refresh token is required' }).optional(),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
