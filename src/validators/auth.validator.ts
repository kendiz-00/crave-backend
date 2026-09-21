import { z } from 'zod';

// Password validation: min 8 chars, uppercase, lowercase, number, special character
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Register validator - phone is now required, email is optional
export const registerSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number must not exceed 15 digits'),
  email: z.string().email('Invalid email address').optional(),
  password: passwordSchema,
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN', 'OWNER']).optional(),
});

// Register with phone verification validator
export const registerWithPhoneVerificationSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number must not exceed 15 digits'),
  email: z.string().email('Invalid email address').optional(),
  password: passwordSchema,
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN', 'OWNER']).optional(),
});

// Login validator (accepts both the legacy email/password format and identifier/password format)
export const loginSchema = z
  .object({
    identifier: z.string().min(1, 'Email or phone is required').optional(),
    email: z.string().email('Invalid email address').optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => !!(data.identifier || data.email), {
    message: 'Email or phone is required',
    path: ['identifier'],
  });

// Refresh token validator
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Types
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterWithPhoneVerificationInput = z.infer<typeof registerWithPhoneVerificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
